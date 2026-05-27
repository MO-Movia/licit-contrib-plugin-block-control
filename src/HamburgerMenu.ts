import { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';

interface MenuItemConfig {
    id: string;
    label: string;
    icon: string;
    action: () => void;
    disabled?: boolean;
}

/**
 * Hamburger menu dropdown component
 * Shows options like: Insert Paragraph Above, Insert Paragraph Below, Delete
 */
class HamburgerMenuDropdown {
    private container: HTMLDivElement;
    private menuItems: MenuItemConfig[];

    constructor(menuItems: MenuItemConfig[]) {
        this.menuItems = menuItems;
        this.container = this.createContainer();
    }

    private createContainer(): HTMLDivElement {
        const container = document.createElement('div');
        container.className = 'enhanced-table-hamburger-menu';

        this.menuItems.forEach((item) => {
            const menuItem = this.createMenuItem(item);
            container.appendChild(menuItem);
        });

        return container;
    }

    private createMenuItem(config: MenuItemConfig): HTMLElement {
        const item = document.createElement('button');
        item.className = 'enhanced-table-hamburger-menu-item';
        item.setAttribute('data-id', config.id);
        item.disabled = config.disabled ?? false;

        // Create icon span
        const iconSpan = document.createElement('span');
        iconSpan.className = 'enhanced-table-hamburger-menu-icon';
        iconSpan.textContent = config.icon;

        // Create label span
        const labelSpan = document.createElement('span');
        labelSpan.className = 'enhanced-table-hamburger-menu-label';
        labelSpan.textContent = config.label;

        item.appendChild(iconSpan);
        item.appendChild(labelSpan);

        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!config.disabled) {
                config.action();
            }
        });

        return item;
    }

    getDom(): HTMLElement {
        return this.container;
    }
}


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
        //TODO:
        // tr.setSelection(selection);

        dispatch(tr);
    }


    insertParagraphBelow(): void {
        const { state, dispatch } = this.view;
        const { schema } = state;

        const paragraph = schema.nodes.paragraph.create();

        const posAfterNode = this.nodePos + this.node.nodeSize;

        const tr = state.tr.insert(posAfterNode, paragraph);

        const selection = tr.doc.resolve(posAfterNode + 1);
        //TODO:
        // tr.setSelection(selection);

        dispatch(tr);
    }


    deleteFigure(): void {
        const { state, dispatch } = this.view;

        const tr = state.tr.delete(this.nodePos, this.nodePos + this.node.nodeSize);

        dispatch(tr);
    }
}



