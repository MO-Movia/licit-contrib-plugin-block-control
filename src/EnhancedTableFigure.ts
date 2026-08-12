// Plugin to handle Citation.
import { Plugin, PluginKey } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';
import { EnhancedTableCommands, removeEmptyNotesCommand } from './EnhancedTableCommands';
import {
  enhancedTableFigureNodeSpec,
  enhancedTableFigureBodyNodeSpec,
  enhancedTableFigureNotesNodeSpec,
  enhancedTableFigureCapcoNodeSpec,
} from './EnhancedTableNodeSpec';
import {
  ENHANCED_TABLE_FIGURE_BODY, ENHANCED_TABLE_FIGURE, ENHANCED_TABLE_FIGURE_CAPCO,
  ENHANCED_TABLE_FIGURE_NOTES
} from './Constants';
import { ImageUploadCommand } from './ImageUploadCommand';
import { EnhancedTableFigureView } from './EnhancedTableFigureView';
import { normalizeLegacyEnhancedTableFigureBodies } from './EnhancedTableNormalizer';
export class EnhancedTableFigure extends Plugin {
  constructor() {
    super({
      key: new PluginKey('EnhancedTableFigure'),
      state: {
        init(_config, _state) {
          // do nothing
        },
        apply(_tr, _set) {
          //do nothing
        },
      },
      props: {
        handleKeyDown(view, event) {
          if (event.key !== 'Backspace') {
            return false;
          }

          return removeEmptyNotesCommand(view.state, view.dispatch);
        },
        nodeViews: {
          enhanced_table_figure(node, view, getPos) {
            return new EnhancedTableFigureView(node, view, getPos);
          },
        },
      },
      appendTransaction(transactions, _oldState, newState) {
        if (!transactions.some((tr) => tr.docChanged)) {
          return null;
        }

        const tr = normalizeLegacyEnhancedTableFigureBodies(
          newState.tr,
          newState.schema
        );
        return tr.steps.length ? tr : null;
      },
      view(editorView) {
        Promise.resolve().then(() => {
          const tr = normalizeLegacyEnhancedTableFigureBodies(
            editorView.state.tr,
            editorView.state.schema
          );
          if (tr.steps.length) {
            editorView.dispatch(tr);
          }
        });

        return {};
      },
    });
  }

  getEffectiveSchema(schema: Schema): Schema {
    const nodes = schema.spec.nodes.append({
      [ENHANCED_TABLE_FIGURE]: enhancedTableFigureNodeSpec,
      [ENHANCED_TABLE_FIGURE_BODY]: enhancedTableFigureBodyNodeSpec,
      [ENHANCED_TABLE_FIGURE_NOTES]: enhancedTableFigureNotesNodeSpec,
      [ENHANCED_TABLE_FIGURE_CAPCO]: enhancedTableFigureCapcoNodeSpec,

    });
    const marks = schema.spec.marks;

    return new Schema({
      nodes: nodes,
      marks: marks,
    });
  }

  initButtonCommands() {

    return {
      '[exposure] Insert Enhanced Table-Figure': [
        {
          ' Table': new EnhancedTableCommands('table'),
          ' Landscape Table': new EnhancedTableCommands('table', {
            withLandscapeSection: true,
          }),
          'Landscape Figure': new ImageUploadCommand({
            withLandscapeSection: true,
          }),
          ' Image': new ImageUploadCommand()
        },
      ],
    };
  }

}
