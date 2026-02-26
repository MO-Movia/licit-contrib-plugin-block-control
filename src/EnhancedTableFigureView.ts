import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { addNotesCommand } from './EnhancedTableCommands';
import { atAnchorBottomCenter, createPopUp, PopUpHandle, uuid } from '@modusoperandi/licit-ui-commands';
import { ImageInlineEditor } from './ui/ImageInlineEditor';
import { ImageViewer } from './ui/ImageViewer';

const FRAMESET_BODY_CLASSNAME = 'czi-editor-frame-body';
const NOTES_CLASSNAME = 'enhanced-table-figure-notes';

export class EnhancedTableFigureView implements NodeView {
  node: ProseMirrorNode;
  view: EditorView;
  getPos: () => number;
  dom: HTMLElement;
  contentDOM: HTMLElement;
  addNotesButton: HTMLButtonElement;
  selectHandle: HTMLElement;
  maximizeButton: HTMLElement;
  _inlineEditor?: PopUpHandle;
  _id = uuid();
  private _popUp = null;
  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // Main container
    this.dom = document.createElement('div');
    this.dom.setAttribute('id', this._id);
    this.dom.className = 'enhanced-table-figure';
    this.dom.dataset.type = 'enhanced-table-figure';
    this.dom.dataset.id = node.attrs.id;
    this.dom.dataset.figureType = node.attrs.figureType;
    this.dom.style.position = 'relative';
    this.dom.style.overflow = 'visible';

    // contentDOM
    this.contentDOM = document.createElement('div');
    const portraitWidthPx = 6.5 * 96; // 624 (864/9 inches)
    // This is the scrollable container
    this.dom.style.width = `${portraitWidthPx}px`;
    this.dom.style.maxWidth = `${portraitWidthPx}px`;
    this.contentDOM.style.width = '100%';

    // end
    this.contentDOM.className = 'enhanced-table-figure-content';
    this.contentDOM.dataset.orientation = node.attrs.orientation;
    this.dom.appendChild(this.contentDOM);

    // Add Notes button
    this.addNotesButton = document.createElement('button');
    this.addNotesButton.className = 'enhanced-table-figure-add-notes';
    this.addNotesButton.classList.add('handle-hidden-on-hover');
    this.addNotesButton.textContent = 'Add Notes';
    Object.assign(this.addNotesButton.style, {
      position: 'absolute',
      bottom: '2px',
      right: '2px',
      display: 'none',
    });
    this.addNotesButton.addEventListener('click', (event) => {
      event.preventDefault();
      const { state, dispatch } = this.view;
      dispatch(addNotesCommand(state.tr, state.schema, this.getPos()));
    });
    this.dom.appendChild(this.addNotesButton);

    // Selection handle
    this.selectHandle = document.createElement('div');
    this.selectHandle.className = 'enhanced-table-figure-select-handle';
    this.selectHandle.textContent = '\u2630';
    Object.assign(this.selectHandle.style, {
      position: 'absolute',
      top: '0px',
      right: '0px',
      cursor: 'pointer',
      padding: '2px 4px',
      background: 'transparent',
      borderRadius: '3px',
      zIndex: '10',
      fontSize: '12px',
      fontWeight: 600
    });
    this.selectHandle.addEventListener('click', (e) => {
      e.preventDefault();
      const { state, dispatch } = this.view;
      const pos = this.getPos();
      if (state.selection instanceof NodeSelection && state.selection.from === pos) {
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos + 1)));
      } else {
        dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
      }
    });
    this.selectHandle.classList.add('handle-hidden-on-hover');
    this.dom.classList.add('has-hover-handle');
    this.dom.appendChild(this.selectHandle);
    // Maximize button
    this.maximizeButton = document.createElement('div');
    this.maximizeButton.className = 'enhanced-table-figure-maximize-button';
    this.maximizeButton.textContent = '\u26f6';
    Object.assign(this.maximizeButton.style, {
      position: 'absolute',
      top: '0px',
      right: '23px',
      cursor: 'pointer',
      padding: '2px 4px',
      background: 'transparent',
      borderRadius: '3px',
      zIndex: '10',
      fontSize: '12px',
      fontWeight: 600
    });
    this.maximizeButton.addEventListener('click', (e) => {
      e.preventDefault();
      const popupNodeViewDom = this.dom.cloneNode(true) as HTMLElement;
      popupNodeViewDom.classList.remove('ProseMirror-selectednode');
      this.copyNotesStylesToPopupClone(popupNodeViewDom);

      const viewPops = {
        nodeViewDom: popupNodeViewDom,
        onClose: (): void => {
          if (this._popUp) {
            this._popUp.close();
            this._popUp = null;
          }
        },
      };

      const anchor = this.view.dom?.parentElement || this.view.dom;
      this._popUp = createPopUp(ImageViewer, viewPops, {
        autoDismiss: false,
        modal: false,
        anchor,
      });

    });
    this.maximizeButton.classList.add('handle-hidden-on-hover');
    this.dom.appendChild(this.maximizeButton);
    this.updateNotesTrigger();
  }

  onResizeEnd = (newWidth: number, newHeight: number) => {
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
    // Only accept updates for the same node type
    if (node.type !== this.node.type) {
      return false;
    }
    this.contentDOM.style.width = '100%';
    // Update the node reference and attributes
    this.node = node;
    this.dom.dataset.id = node.attrs.id;
    this.dom.dataset.figureType = node.attrs.figureType;
    this.dom.dataset.orientation = node.attrs.orientation;
    this.dom.dataset.maximized = node.attrs.maximized ? 'true' : 'false';

    // Update class names while preserving important classes
    const baseClasses = ['enhanced-table-figure'];
    if (node.attrs.orientation === 'landscape') baseClasses.push('landscape');
    if (node.attrs.maximized) baseClasses.push('maximized');
    if (this.dom.classList.contains('ProseMirror-selectednode')) {
      baseClasses.push('ProseMirror-selectednode');
    }
    if (this.dom.classList.contains('has-hover-handle')) {
      baseClasses.push('has-hover-handle');
    }
    this.dom.className = baseClasses.join(' ');

    this.updateNotesTrigger();

    // Return true to indicate we've handled the update
    // ProseMirror will update the contentDOM children automatically
    return true;
  }

  updateNotesTrigger() {
    let notesExists = false;
    this.node.forEach(child => {
      if (child.type.name === 'enhanced_table_figure_notes') {
        notesExists = true;
      }
    });
    this.addNotesButton.style.display =
      !notesExists && (this.node.attrs.figureType === 'table' || this.node.attrs.figureType === 'figure') ? 'block' : 'none';
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode');
    this.dom.dataset.active = 'true';
    this._renderInlineEditor();
  }

  deselectNode() {
    delete this.dom.dataset.active;
    this._inlineEditor?.close?.(undefined);
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  destroy() {
    this._inlineEditor?.close?.(undefined);
  }

  stopEvent(_event: Event): boolean {
    return false;
  }

  private _renderInlineEditor(): void {
    const editorProps = {
      value: this.node.attrs,
      onSelect: this._onChange,
      editorView: this.view,
    };
    const el = document.getElementById(this._id);
    if (el?.dataset?.active !== 'true') {
      this._inlineEditor?.close?.(undefined);
      return;
    }

    if (!this._inlineEditor) {
      this._inlineEditor = createPopUp(ImageInlineEditor, editorProps, {
        anchor: el,
        autoDismiss: false,
        container: el.closest(`.${FRAMESET_BODY_CLASSNAME}`),
        position: atAnchorBottomCenter,
        onClose: () => {
          this._inlineEditor = null;
        },
      });
    }
  }

  _onChange = (value?: { align: string }): void => {

    const align = value ? value.align : null;
    const pos = this.getPos();
    const attrs = {
      ...this.node.attrs,
      align,
    };

    let tr = this.view.state.tr;
    const { selection } = this.view.state;
    tr = tr.setNodeMarkup(pos, null, attrs);
    // reset selection to original using the latest doc.
    const origSelection = NodeSelection.create(tr.doc, selection.from);
    tr = tr.setSelection(origSelection);
    this.view.dispatch(tr);
  };

  private copyNotesStylesToPopupClone(cloneRoot: HTMLElement): void {
    const sourceNotes = Array.from(
      this.dom.getElementsByClassName(NOTES_CLASSNAME)
    ) as HTMLElement[];
    const targetNotes = Array.from(
      cloneRoot.getElementsByClassName(NOTES_CLASSNAME)
    ) as HTMLElement[];

    targetNotes.forEach((targetNote, noteIndex) => {
      const sourceNote = sourceNotes[noteIndex];
      if (!sourceNote) {
        return;
      }

      const sourceNodes = [
        sourceNote,
        ...Array.from(sourceNote.querySelectorAll('*')),
      ] as HTMLElement[];
      const targetNodes = [
        targetNote,
        ...Array.from(targetNote.querySelectorAll('*')),
      ] as HTMLElement[];

      targetNodes.forEach((targetNode, nodeIndex) => {
        const sourceNode = sourceNodes[nodeIndex];
        if (!sourceNode) {
          return;
        }

        const computed = globalThis.getComputedStyle(sourceNode);
        if (computed.color) {
          targetNode.style.setProperty('color', computed.color, 'important');
        }
        if (computed.opacity) {
          targetNode.style.setProperty(
            'opacity',
            computed.opacity,
            'important'
          );
        }
      });
    });
  }
}
