# EnhancedTableFigure ProseMirror Plugin For Licit

The **Enhanced Table Figure** project provides a dynamic and customizable solution for rendering tables with advanced features, primarily aimed at creating editable and responsive table views with support for complex data manipulation. 

## Build

### Dependency

### Commands

- npm ci

- npm pack

#### To use this in Licit

Include plugin in licit component

- import EnhancedTableFigure

- add EnhancedTableFigure array in licit's plugin array

```

import { EnhancedTableFigure }  from  '@modusoperandi/licit-enhanced-table-figure';


const  plugins = [new EnhancedTableFigure()]

ReactDOM.render(<Licit docID={0} plugins={plugins}/>


```
