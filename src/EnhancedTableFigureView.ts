import * as React from 'react';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { addNotesCommand } from './EnhancedTableCommands';
import { atAnchorBottomCenter, createPopUp, PopUpHandle, uuid } from '@modusoperandi/licit-ui-commands';
import { ImageInlineEditor } from './ui/ImageInlineEditor';
import { ImageViewer } from './ui/ImageViewer';

const FRAMESET_BODY_CLASSNAME = 'czi-editor-frame-body';
const PORTRAIT_WIDTH_PX = 6.5 * 96; // 624 (864/9 inches)

/**
 * Menu item interface for dropdown
 */
interface MenuItemConfig {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  disabled?: boolean;
}

/**
 * Hamburger menu dropdown component
 */
interface HamburgerMenuDropdownProps {
  menuItems: MenuItemConfig[];
  close: () => void;
}

function HamburgerMenuDropdownView({ menuItems }: HamburgerMenuDropdownProps): React.ReactElement {
  return React.createElement(
    'div',
    { className: 'enhanced-table-hamburger-menu' },
    ...menuItems.map((item) =>
      React.createElement(
        'button',
        {
          key: item.id,
          className: 'enhanced-table-hamburger-menu-item',
          'data-id': item.id,
          disabled: item.disabled ?? false,
          type: 'button',
          onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            e.stopPropagation();
            if (!item.disabled) {
              item.action();
            }
          },
        },
        React.createElement('span', { className: 'enhanced-table-hamburger-menu-icon' }, item.icon),
        React.createElement('span', { className: 'enhanced-table-hamburger-menu-label' }, item.label)
      )
    )
  );
}

/**
 * Command registry for figure operations
 * Encapsulates all commands related to figures
 */
class FigureCommandRegistry {
  private nodePos: number;
  private node: ProseMirrorNode;
  private view: EditorView;

  constructor(nodePos: number, node: ProseMirrorNode, view: EditorView) {
    this.nodePos = nodePos;
    this.node = node;
    this.view = view;
  }

  /**
   * Insert paragraph above the figure
   * 
   * What's passed:
   * - tr (Transaction): state.tr for mutations
   * - pos (number): this.nodePos (position of figure)
   * - schema: state.schema for creating nodes
   */
  insertParagraphAbove(): void {
    const { state, dispatch } = this.view;
    const { schema } = state;

    // Create empty paragraph node
    const paragraph = schema.nodes.paragraph.create();

    // Insert at the node position
    let tr = state.tr.insert(this.nodePos, paragraph);

    // Set cursor in the new paragraph
    const resolvedPos = tr.doc.resolve(this.nodePos + 1);
    tr = tr.setSelection(TextSelection.create(tr.doc, resolvedPos.pos));

    dispatch(tr);
  }

  /**
   * Insert paragraph below the figure
   * 
   * What's passed:
   * - tr (Transaction): state.tr for mutations
   * - pos (number): this.nodePos + this.node.nodeSize (position after figure)
   * - schema: state.schema for creating nodes
   */
  insertParagraphBelow(): void {
    const { state, dispatch } = this.view;
    const { schema } = state;

    // Create empty paragraph node
    const paragraph = schema.nodes.paragraph.create();

    // Calculate position after the figure
    const posAfterNode = this.nodePos + this.node.nodeSize;

    // Insert after the node
    let tr = state.tr.insert(posAfterNode, paragraph);

    // Set cursor in the new paragraph
    const resolvedPos = tr.doc.resolve(posAfterNode + 1);
    tr = tr.setSelection(TextSelection.create(tr.doc, resolvedPos.pos));

    dispatch(tr);
  }

  /**
   * Delete the figure node
   * 
   * What's passed:
   * - pos (number): this.nodePos (start position)
   * - endPos (number): this.nodePos + this.node.nodeSize (end position)
   */
  deleteFigure(): void {
    const { state, dispatch } = this.view;

    // Delete from start to end of node
    const from = this.nodePos;
    const to = this.nodePos + this.node.nodeSize;

    const tr = state.tr.delete(from, to);

    dispatch(tr);
  }
}

/**
 * Manages PopUp lifecycle to prevent memory leaks
 */
class PopUpManager {
  private popUps = new Map<string, PopUpHandle>();

  create(name: string, Component: any, props: any, options: any): PopUpHandle {
    this.close(name); // Close any existing PopUp with this name
    const handle = createPopUp(Component, props, options);
    this.popUps.set(name, handle);
    return handle;
  }

  close(name: string): void {
    const handle = this.popUps.get(name);
    if (handle) {
      handle.close?.(undefined);
      this.popUps.delete(name);
    }
  }

  closeAll(): void {
    this.popUps.forEach((handle) => {
      handle.close?.(undefined);
    });
    this.popUps.clear();
  }

  has(name: string): boolean {
    return this.popUps.has(name);
  }
}

/**
 * Encapsulates handle UI creation and state
 */
class HandleController {
  selectHandle: HTMLElement;
  addNotesButton: HTMLButtonElement;
  maximizeButton?: HTMLElement;
  private onHamburgerClick: (e: Event) => void;
  private onNotesClick: (e: Event) => void;
  private onMaximizeClick: (e: Event) => void;

  constructor(
    onHamburgerClick: (e: Event) => void,
    onNotesClick: (e: Event) => void,
    onMaximizeClick: (e: Event) => void
  ) {
    this.onHamburgerClick = onHamburgerClick;
    this.onNotesClick = onNotesClick;
    this.onMaximizeClick = onMaximizeClick;

    this.selectHandle = this.createHamburgerHandle();
    this.addNotesButton = this.createAddNotesButton();
  }

  private createHamburgerHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'enhanced-table-figure-select-handle handle-hidden-on-hover';
    handle.setAttribute('aria-label', 'Figure menu');
    handle.setAttribute('role', 'button');
    handle.setAttribute('tabindex', '0');
    handle.textContent = '☰';
    handle.addEventListener('click', this.onHamburgerClick);

    // Keyboard support
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onHamburgerClick(e);
      }
    });

    return handle;
  }

  private createAddNotesButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'enhanced-table-figure-add-notes handle-hidden-on-hover';
    button.textContent = 'Add Notes';
    button.setAttribute('aria-label', 'Add notes to this figure');
    button.addEventListener('click', this.onNotesClick);
    return button;
  }

  createMaximizeButton(): HTMLElement {
    if (this.maximizeButton) return this.maximizeButton;

    const button = document.createElement('div');
    button.className = 'enhanced-table-figure-maximize-button handle-hidden-on-hover';
    button.setAttribute('aria-label', 'Maximize figure');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.textContent = '⛶';
    button.addEventListener('click', this.onMaximizeClick);

    // Keyboard support
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onMaximizeClick(e);
      }
    });

    this.maximizeButton = button;
    return button;
  }

  updateNotesVisibility(visible: boolean, showButton: boolean): void {
    this.addNotesButton.style.display = showButton ? 'block' : 'none';
  }

  destroy(): void {
    this.selectHandle.removeEventListener('click', this.onHamburgerClick);
    this.addNotesButton.removeEventListener('click', this.onNotesClick);
    if (this.maximizeButton) {
      this.maximizeButton.removeEventListener('click', this.onMaximizeClick);
    }
  }
}

/**
 * Enhanced NodeView for table figures with hamburger menu dropdown
 */
export class EnhancedTableFigureView implements NodeView {
  node: ProseMirrorNode;
  view: EditorView;
  getPos: () => number;
  dom: HTMLElement;
  contentDOM: HTMLElement;

  private _id = uuid();
  private _popUpManager = new PopUpManager();
  private _handleController: HandleController;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // Setup main container
    this.dom = this.createMainContainer();
    this.contentDOM = this.createContentDOM();
    this.dom.appendChild(this.contentDOM);

    // Setup handles with hamburger menu
    this._handleController = new HandleController(
      (e) => this.handleHamburgerMenuClick(e),
      (e) => this.handleNotesClick(e),
      (e) => this.handleMaximizeClick(e)
    );

    this.dom.appendChild(this._handleController.selectHandle);
    this.dom.appendChild(this._handleController.addNotesButton);

    if (node.attrs.figureType !== 'table') {
      this.dom.appendChild(this._handleController.createMaximizeButton());
    }

    this.updateNotesTrigger();
  }

  private createMainContainer(): HTMLElement {
    const dom = document.createElement('div');
    dom.setAttribute('id', this._id);
    dom.setAttribute('data-type', 'enhanced-table-figure');
    dom.setAttribute('data-id', this.node.attrs.id);
    dom.setAttribute('data-figure-type', this.node.attrs.figureType);
    dom.setAttribute('data-active', 'false');
    dom.className = 'enhanced-table-figure has-hover-handle';
    return dom;
  }

  private createContentDOM(): HTMLElement {
    const contentDOM = document.createElement('div');
    contentDOM.className = 'enhanced-table-figure-content';
    contentDOM.dataset['orientation'] = this.node.attrs.orientation;
    return contentDOM;
  }


  private handleHamburgerMenuClick(e: Event): void {
    e.preventDefault();

    // Create command registry with current node context
    const commandRegistry = new FigureCommandRegistry(this.getPos(), this.node, this.view);

    const menuItems: MenuItemConfig[] = [
      {
        id: 'insert-above',
        label: 'Insert paragraph above',
        icon: '⬆',
        action: () => {
          commandRegistry.insertParagraphAbove();
          this._popUpManager.close('hamburger-menu');
        },
      },
      {
        id: 'insert-below',
        label: 'Insert paragraph below',
        icon: '⬇',
        action: () => {
          commandRegistry.insertParagraphBelow();
          this._popUpManager.close('hamburger-menu');
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: '🗑',
        action: () => {
          commandRegistry.deleteFigure();
          this._popUpManager.close('hamburger-menu');
        },
      },
    ];

    this._popUpManager.create('hamburger-menu', HamburgerMenuDropdownView, { menuItems }, {
      autoDismiss: true,
      anchor: this._handleController.selectHandle,
    });
  }

  private handleNotesClick(e: Event): void {
    e.preventDefault();
    const { state, dispatch } = this.view;
    dispatch(addNotesCommand(state.tr, state.schema, this.getPos()));
  }

  private handleMaximizeClick(e: Event): void {
    e.preventDefault();
    const cleanDom = this.createCleanViewerDom();

    const viewProps = {
      nodeViewDom: cleanDom,
      onClose: () => this._popUpManager.close('maximized-view'),
    };

    const anchor = this.view?.dom?.parentElement ?? this.view?.dom ?? this.dom;
    this._popUpManager.create('maximized-view', ImageViewer, viewProps, {
      autoDismiss: false,
      modal: false,
      anchor,
    });
  }

  // Only includes content, no handles
  private createCleanViewerDom(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'enhanced-table-figure';
    wrapper.setAttribute('data-id', this.node.attrs.id);
    wrapper.setAttribute('data-figure-type', this.node.attrs.figureType);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'enhanced-table-figure-content';

    // Deep clone actual content
    const actualContent = this.contentDOM.cloneNode(true);
    contentWrapper.appendChild(actualContent);
    wrapper.appendChild(contentWrapper);

    return wrapper;
  }

  onResizeEnd = (newWidth: number, newHeight: number): void => {
    const { state, dispatch } = this.view;
    const pos = this.getPos();
    dispatch(
      state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        width: newWidth,
        height: newHeight,
      })
    );
  };

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    this.updateAttributes();
    this.updateNotesTrigger();

    return true;
  }

  private updateAttributes(): void {
    // Update data attributes
    this.dom.setAttribute('data-id', this.node.attrs.id);
    this.dom.setAttribute('data-figure-type', this.node.attrs.figureType);
    this.dom.dataset['orientation'] = this.node.attrs.orientation;
    this.dom.dataset['maximized'] = this.node.attrs.maximized ? 'true' : 'false';
    this.contentDOM.dataset['orientation'] = this.node.attrs.orientation;

    // Update classes
    this.updateClasses();
  }

  private updateClasses(): void {
    const baseClasses = ['enhanced-table-figure', 'has-hover-handle'];
    if (this.node.attrs.orientation === 'landscape') baseClasses.push('landscape');
    if (this.node.attrs.maximized) baseClasses.push('maximized');
    if (this.dom.classList.contains('ProseMirror-selectednode')) {
      baseClasses.push('ProseMirror-selectednode');
    }
    this.dom.className = baseClasses.join(' ');
  }

  private updateNotesTrigger(): void {
    let notesExists = false;
    this.node.forEach((child) => {
      if (child.type.name === 'enhanced_table_figure_notes') {
        notesExists = true;
      }
    });

    const shouldShowAddButton =
      !notesExists &&
      (this.node.attrs.figureType === 'table' || this.node.attrs.figureType === 'figure');

    this._handleController.updateNotesVisibility(!notesExists, shouldShowAddButton);
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    this.dom.setAttribute('data-active', 'true');
    this.renderInlineEditor();
  }

  deselectNode(): void {
    this.dom.setAttribute('data-active', 'false');
    this._popUpManager.close('inline-editor');
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  destroy(): void {
    this._popUpManager.closeAll();
    this._handleController.destroy();
  }

  stopEvent(_event: Event): boolean {
    return false;
  }

  private renderInlineEditor(): void {
    const el = document.getElementById(this._id);
    if (!el || el.getAttribute('data-active') !== 'true') {
      this._popUpManager.close('inline-editor');
      return;
    }

    const editorProps = {
      value: this.node.attrs,
      onSelect: this.handleInlineEditorChange,
      editorView: this.view,
    };

    this._popUpManager.create('inline-editor', ImageInlineEditor, editorProps, {
      anchor: el,
      autoDismiss: false,
      container: el.closest(`.${FRAMESET_BODY_CLASSNAME}`),
      position: atAnchorBottomCenter,
      onClose: () => {
        // nothing to do
      },
    });
  }

  private handleInlineEditorChange = (value?: { align: string }): void => {
    const align = value ? value.align : null;
    const pos = this.getPos();
    const attrs = {
      ...this.node.attrs,
      align,
    };

    let tr = this.view.state.tr;
    const { selection } = this.view.state;
    tr = tr.setNodeMarkup(pos, null, attrs);

    // Preserve selection
    const origSelection = NodeSelection.create(tr.doc, selection.from);
    tr = tr.setSelection(origSelection);
    this.view.dispatch(tr);
  };
}
