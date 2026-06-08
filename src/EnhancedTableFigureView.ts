import * as React from 'react';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { addNotesCommand } from './EnhancedTableCommands';
import { atAnchorTopCenter, createPopUp, PopUpHandle, uuid } from '@modusoperandi/licit-ui-commands';
import { ImageViewer } from './ui/ImageViewer';
import { CropImagePopup, CropDataPropValue } from './ui/CropImagePopup';
import { Icon } from './ui/Icon';

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
        React.createElement(
          'span',
          { className: 'enhanced-table-hamburger-menu-icon' },
          Icon.get(item.icon, item.label)
        ),
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
  private readonly nodePos: number;
  private readonly node: ProseMirrorNode;
  private readonly view: EditorView;

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
  private readonly popUps = new Map<string, PopUpHandle>();

  create(name: string, Component: unknown, props, options: unknown): PopUpHandle {
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
    for (const handle of this.popUps.values()) {
      handle.close?.(undefined);
    }
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
  maximizeButton?: HTMLElement;
  private readonly onHamburgerClick: (e: Event) => void;
  private readonly onMaximizeClick: (e: Event) => void;

  constructor(
    onHamburgerClick: (e: Event) => void,
    onMaximizeClick: (e: Event) => void
  ) {
    this.onHamburgerClick = onHamburgerClick;
    this.onMaximizeClick = onMaximizeClick;

    this.selectHandle = this.createHamburgerHandle();
  }

  private createHamburgerHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'enhanced-table-figure-select-handle handle-hidden-on-hover';
    handle.setAttribute('aria-label', 'Figure menu'); // NOSONAR
    handle.setAttribute('role', 'button'); // NOSONAR
    handle.setAttribute('tabindex', '0'); // NOSONAR
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

  destroy(): void {
    this.selectHandle.removeEventListener('click', this.onHamburgerClick);
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

  private readonly _id = uuid();
  private readonly _popUpManager = new PopUpManager();
  private readonly _handleController: HandleController;

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
      (e) => this.handleMaximizeClick(e)
    );

    this.dom.appendChild(this._handleController.selectHandle);

    if (node.attrs.figureType !== 'table') {
      this.dom.appendChild(this._handleController.createMaximizeButton());
    }

  }

  private createMainContainer(): HTMLElement {
    const dom = document.createElement('div');
    dom.setAttribute('id', this._id);// NOSONAR
    dom.setAttribute('data-type', 'enhanced-table-figure');// NOSONAR
    dom.setAttribute('data-id', this.node.attrs.id);// NOSONAR
    dom.setAttribute('data-figure-type', this.node.attrs.figureType);// NOSONAR
    dom.setAttribute('data-active', 'false');// NOSONAR
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

    // Determine if notes can be added
    let notesExists = false;
    for (const [child] of this.iterChildren(this.node)) {
      if (child.type.name === 'enhanced_table_figure_notes') {
        notesExists = true;
      }
    }

    const canAddNotes =
      !notesExists &&
      (this.node.attrs.figureType === 'table' || this.node.attrs.figureType === 'figure');

    const fullMenuItems: MenuItemConfig[] = [
      {
        id: 'insert-above',
        label: 'Insert Paragraph Above',
        icon: 'north',
        action: () => {
          commandRegistry.insertParagraphAbove();
          this._popUpManager.close('hamburger-menu');
        },
      },
      {
        id: 'insert-below',
        label: 'Insert Paragraph Below',
        icon: 'south',
        action: () => {
          commandRegistry.insertParagraphBelow();
          this._popUpManager.close('hamburger-menu');
        },
      },
      {
        id: 'choose-file',
        label: 'Choose File',
        icon: 'folder_open',
        action: () => {
          this.handleChooseFile();
          this._popUpManager.close('hamburger-menu');
        },
      },
      {
        id: 'paste-clipboard',
        label: 'Paste from Clipboard',
        icon: 'content_paste',
        action: () => {
          this.handlePasteFromClipboard();
          this._popUpManager.close('hamburger-menu');
        },
      },
      ...(canAddNotes
        ? [
          {
            id: 'add-notes',
            label: 'Add Notes',
            icon: 'note_add',
            action: () => {
              this.handleNotesClick(e);
              this._popUpManager.close('hamburger-menu');
            },
          },
        ]
        : []),
      {
        id: 'crop',
        label: 'Crop',
        icon: 'crop',
        action: () => {
          this.handleCrop();
          this._popUpManager.close('hamburger-menu');
        },
      },
      {
        id: 'reset-crop',
        label: 'Reset Crop',
        icon: 'restore',
        action: () => {
          this.handleResetCrop();
          this._popUpManager.close('hamburger-menu');
        },
      },

      {
        id: 'delete',
        label: 'Delete',
        icon: 'delete',
        action: () => {
          commandRegistry.deleteFigure();
          this._popUpManager.close('hamburger-menu');
        },
      },
    ];

    // If this is a table figure, restrict to only the requested subset of items
    const figureType = this.node.attrs.figureType;
    let menuItems: MenuItemConfig[] = fullMenuItems;
    if (figureType === 'table') {
      const allowed = new Set(['insert-above', 'insert-below', 'add-notes', 'delete']);
      menuItems = fullMenuItems.filter((it) => allowed.has(it.id));
    }

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

  private handleCrop(): void {
    // Trigger crop functionality
    const pos = this.getPos();
    const { state, dispatch } = this.view;
    const imagePath = this.findImagePath(pos);

    if (imagePath !== null) {
      const imageNode = state.doc.nodeAt(imagePath);
      const src = imageNode.attrs.src;

      const popupHandle = createPopUp(
        CropImagePopup,
        {
          src,
          position: atAnchorTopCenter,
          onConfirm: (cropData: CropDataPropValue) => {
            const tr = state.tr.setNodeMarkup(imagePath, null, {
              ...imageNode.attrs,
              cropData,
            });
            if (popupHandle) {
              popupHandle.close(cropData);
            }
            dispatch(tr);
          },
          onCancel: () => {
            if (popupHandle) {
              popupHandle.close(null);
            }
          },
          defaultUnit: 'px',
        },
        {
          anchor: document.body,
          autoDismiss: false,
        }
      );
    }
  }

  private handleResetCrop(): void {
    // Reset crop data on the image node
    const pos = this.getPos();
    const { state, dispatch } = this.view;

    // Find the image node and reset its cropData
    const imagePath = this.findImagePath(pos);

    if (imagePath !== null) {
      const imageNode = state.doc.nodeAt(imagePath);
      if (imageNode) {
        const tr = state.tr.setNodeMarkup(imagePath, undefined, {
          ...imageNode.attrs,
          cropData: null,
        });
        dispatch(tr);
      }
    }
  }

  private handleChooseFile(): void {
    // Open file chooser dialog
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];

      if (file) {
        // Handle file selection
        const reader = new FileReader();
        reader.onload = (e) => {
          const src = e.target?.result as string;
          if (src) {
            this.updateImageSource(src);
          }
        };
        reader.readAsDataURL(file);
      }
    };

    fileInput.click();
  }

  private handlePasteFromClipboard(): void {
    // Read image from clipboard
    if (!navigator.clipboard?.read) {
      console.error('Clipboard API not available');
      return;
    }

    navigator.clipboard.read().then((clipboardItems) => {
      for (const clipboardItem of clipboardItems) {
        const imageTypes = clipboardItem.types.filter((type) => type.startsWith('image/'));
        if (imageTypes.length > 0) {
          clipboardItem.getType(imageTypes[0]).then((blob) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              if (src) {
                this.updateImageSource(src);
              }
            };
            reader.readAsDataURL(blob);
          });
          return;
        }
      }
    }).catch((err) => {
      console.error('Failed to read from clipboard:', err);
    });
  }

  private updateImageSource(src: string): void {
    // Update the image source in the document
    const pos = this.getPos();
    const { state, dispatch } = this.view;

    const imagePath = this.findImagePath(pos);

    if (imagePath !== null) {
      const imageNode = state.doc.nodeAt(imagePath);
      if (imageNode) {
        const tr = state.tr.setNodeMarkup(imagePath, undefined, {
          ...imageNode.attrs,
          src,
        });
        dispatch(tr);
      }
    }
  }

  private findImagePath(figurePos: number): number | null {
    // Find the path to the image node within the figure
    // Structure: enhanced_table_figure > enhanced_table_figure_body (paragraph) > image
    let imagePath = null;

    for (const [child, childOffset] of this.iterChildren(this.node)) {
      if (child.type.name !== 'enhanced_table_figure_body') {
        continue;
      }

      const bodyContentStart = figurePos + childOffset + 2;
      const bodyImagePath = this.findImageInFigureBody(child, bodyContentStart);
      if (bodyImagePath !== null) {
        imagePath = bodyImagePath;
      }
    }

    return imagePath;
  }

  private findImageInFigureBody(bodyNode: ProseMirrorNode, bodyContentStart: number): number | null {
    let imagePath = null;

    for (const [contentChild, contentOffset] of this.iterChildren(bodyNode)) {
      const contentPath = bodyContentStart + contentOffset;
      if (contentChild.type.name === 'image') {
        imagePath = contentPath;
        continue;
      }

      const nestedImagePath = this.findNestedImageInNode(contentChild, contentPath);
      if (nestedImagePath !== null) {
        imagePath = nestedImagePath;
      }
    }

    return imagePath;
  }

  private findNestedImageInNode(node: ProseMirrorNode, basePath: number): number | null {
    // Recursively search for image node in nested content
    if (node.type.name === 'image') {
      return basePath;
    }

    if (node.content && node.content.size > 0) {
      let found = null;
      for (const [child, offset] of this.iterChildren(node)) {
        if (!found) {
          if (child.type.name === 'image') {
            found = basePath + 1 + offset;
          } else {
            found = this.findNestedImageInNode(child, basePath + 1 + offset);
          }
        }
      }
      return found;
    }

    return null;
  }

  private *iterChildren(node: ProseMirrorNode): IterableIterator<[ProseMirrorNode, number]> {
    let offset = 0;
    for (let index = 0; index < node.childCount; index += 1) {
      const child = node.child(index);
      yield [child, offset];
      offset += child.nodeSize;
    }
  }



  // Only includes content, no handles
  private createCleanViewerDom(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'enhanced-table-figure';
    wrapper.setAttribute('data-id', this.node.attrs.id); // NOSONAR
    wrapper.setAttribute('data-figure-type', this.node.attrs.figureType); // NOSONAR

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
    return true;
  }

  private updateAttributes(): void {
    // Update data attributes
    this.dom.setAttribute('data-id', this.node.attrs.id); // NOSONAR
    this.dom.setAttribute('data-figure-type', this.node.attrs.figureType); // NOSONAR
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



  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    this.dom.setAttribute('data-active', 'true'); // NOSONAR
  }

  deselectNode(): void {
    this.dom.setAttribute('data-active', 'false'); // NOSONAR
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



}
