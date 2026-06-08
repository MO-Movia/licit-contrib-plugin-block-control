import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';

export class FigureCommandRegistry {
    private nodePos: number;
    private node: ProseMirrorNode;
    private view: EditorView;

    constructor(nodePos: number, node: ProseMirrorNode, view: EditorView) {
        this.nodePos = nodePos;
        this.node = node;
        this.view = view;
    }


    insertParagraphAbove(): void {
        const { state, dispatch } = this.view;
        const { schema } = state;
        const paragraph = schema.nodes.paragraph.create();
        const tr = state.tr.insert(this.nodePos, paragraph);
        const selection = tr.doc.resolve(this.nodePos + 1);

        tr.setSelection(new TextSelection(selection));
        dispatch(tr);
    }


    insertParagraphBelow(): void {
        const { state, dispatch } = this.view;
        const { schema } = state;
        const paragraph = schema.nodes.paragraph.create();
        const posAfterNode = this.nodePos + this.node.nodeSize;
        const tr = state.tr.insert(posAfterNode, paragraph);
        const selection = tr.doc.resolve(posAfterNode + 1);

        tr.setSelection(new TextSelection(selection));
        dispatch(tr);
    }


    deleteFigure(): void {
        const { state, dispatch } = this.view;

        const tr = state.tr.delete(this.nodePos, this.nodePos + this.node.nodeSize);

        dispatch(tr);
    }
}



