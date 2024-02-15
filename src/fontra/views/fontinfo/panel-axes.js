import * as html from "../core/html-utils.js";
import { addStyleSheet } from "../core/html-utils.js";
import { ObservableController } from "../core/observable-object.js";
import * as svg from "../core/svg-utils.js";
import { labeledTextInput, setupSortableList } from "../core/ui-utils.js";
import { enumerate, range, zip } from "../core/utils.js";
import { piecewiseLinearMap } from "../core/var-model.js";
import { IconButton } from "../web-components/icon-button.js"; // for <icon-button>
import { UIList } from "../web-components/ui-list.js";
import { BaseInfoPanel } from "./panel-base.js";

export class AxesPanel extends BaseInfoPanel {
  static title = "Axes";
  static id = "axes-panel";

  setupUI() {
    const fontController = this.fontInfoController.fontController;

    const axisContainer = html.div({
      style: "display: grid; gap: 0.5em;",
    });

    for (const axis of fontController.globalAxes) {
      axisContainer.appendChild(new AxisBox(axis));
    }

    setupSortableList(axisContainer);

    axisContainer.addEventListener("reordered", (event) =>
      console.log("list reordered")
    );

    this.panelElement.appendChild(axisContainer);
  }
}

addStyleSheet(`
.fontra-ui-font-info-axes-panel-axis-box {
  background-color: var(--ui-element-background-color);
  border-radius: 0.5em;
  padding: 1em;
  cursor: pointer;
  display: grid;
  grid-template-columns: max-content max-content max-content max-content auto;
  gap: 1em;
}

.fontra-ui-font-info-axes-panel-axis-box-values,
.fontra-ui-font-info-axes-panel-axis-box-names {
  display: grid;
  grid-template-columns: minmax(4.5em, max-content) max-content;
  gap: 0.5em;
  align-items: start;
  align-content: start;
}

.fontra-ui-font-info-axes-panel-axis-box-mapping-list {
  width: 8em;
  max-height: 12em;
}

.fontra-ui-font-info-axes-panel-axis-box-delete {
  justify-self: end;
  align-self: start;
}
`);

class AxisBox {
  constructor(axis) {
    const axisModel = { ...axis };
    const axisItems = !axisModel.values
      ? [
          ["Minimum", "minValue"],
          ["Default", "defaultValue"],
          ["Maximum", "maxValue"],
        ]
      : [
          ["Values", "valuesString"],
          ["Default", "defaultValue"],
        ];
    if (axisModel.values) {
      axisModel.valuesString = axisModel.values.join(" ");
    }
    this.axisController = new ObservableController(axisModel);

    this.mappingGraph = buildMappingGraph(this.axisController);
    this.mappingList = buildMappingList(this.axisController);

    return html.div(
      { class: "fontra-ui-font-info-axes-panel-axis-box", draggable: true },
      [
        html.div(
          { class: "fontra-ui-font-info-axes-panel-axis-box-names" },
          [
            ["Name", "name"],
            ["OT Tag", "tag"],
            ["UI Name", "label"],
          ]
            .map(([labelName, keyName]) =>
              labeledTextInput(labelName, this.axisController, keyName)
            )
            .flat()
        ),
        html.div(
          { class: "fontra-ui-font-info-axes-panel-axis-box-values" },
          axisItems
            .map(([labelName, keyName]) =>
              labeledTextInput(labelName, this.axisController, keyName, {
                type: keyName === "valuesString" ? "text" : "number",
              })
            )
            .flat()
        ),
        this.mappingGraph,
        this.mappingList,
        html.createDomElement("icon-button", {
          "class": "fontra-ui-font-info-axes-panel-axis-box-delete",
          "src": "/tabler-icons/trash.svg",
          "onclick": (event) => console.log("delete axis"),
          "data-tooltip": "Delete axis",
        }),
      ]
    );
  }
}

function buildMappingGraph(axisController) {
  const axis = axisController.model;
  // if (!axis.mapping.length) {
  //   return html.div(); // filler
  // }
  const marginLeft = 16;
  const marginRight = 16;
  const marginTop = 16;
  const marginBottom = 16;
  const labelOffset = -13;
  const graphSize = 120;
  const width = graphSize + marginLeft + marginRight;
  const height = graphSize + marginTop + marginBottom;
  const xs = axis.mapping.map(([x, y]) => x);
  const ys = axis.mapping.map(([x, y]) => y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const graphX = xs.map((x) => (graphSize * (x - xMin)) / (xMax - xMin));
  const graphY = ys.map((y) => (graphSize * (y - yMin)) / (yMax - yMin));
  const graphPoints = [...zip(graphX, graphY)].map(([x, y]) => {
    return { x, y };
  });
  let defaultLines = [];
  if (
    axis.mapping.length &&
    axis.defaultValue != axis.minValue &&
    axis.defaultValue != axis.maxValue
  ) {
    const defaultX = (graphSize * (axis.defaultValue - xMin)) / (xMax - xMin);
    const mappedDefault = piecewiseLinearMap(
      axis.defaultValue,
      Object.fromEntries(axis.mapping || [])
    );
    const defaultY = (graphSize * (mappedDefault - yMin)) / (yMax - yMin);

    defaultLines = [
      svg.line({
        class: "grid default-line",
        x1: defaultX,
        y1: 0,
        x2: defaultX,
        y2: graphSize,
      }),
      svg.line({
        class: "grid default-line",
        x1: 0,
        y1: defaultY,
        x2: graphSize,
        y2: defaultY,
      }),
    ];
  }

  const graphLabels = (v1, v2, v3) => {
    return [
      svg.text({ x: 0, y: 0, transform: svg.scale(1, -1) }, [v1]),
      svg.text(
        {
          "x": graphSize / 2,
          "y": 0,
          "transform": svg.scale(1, -1),
          "text-anchor": "middle",
        },
        [v2]
      ),
      svg.text(
        {
          "x": graphSize,
          "y": 0,
          "transform": svg.scale(1, -1),
          "text-anchor": "end",
        },
        [v3]
      ),
    ];
  };

  const graphElement = svg.polyline({
    class: "graph",
    points: svg.points(graphPoints),
  });

  const nodes = [];
  for (const [i, { x, y }] of enumerate(graphPoints)) {
    nodes.push(
      svg.circle({
        class: "node",
        cx: x,
        cy: y,
        onmouseenter: (event) => {
          nodeCoordinates[i].classList.add("visible");
          nodes.map((node) => {
            if (node !== event.target) {
              node.classList.add("faded");
            }
            defaultLines.map((element) => element.classList.add("faded"));
            graphElement.classList.add("faded");
          });
        },
        onmouseleave: (event) => {
          nodeCoordinates[i].classList.remove("visible");
          nodes.map((node) => node.classList.remove("faded"));
          defaultLines.map((element) => element.classList.remove("faded"));
          graphElement.classList.remove("faded");
        },
        onclick: (event) => {
          console.log("click");
        },
      })
    );
  }

  const nodeCoordinates = [];
  for (const i of range(graphPoints.length)) {
    const coordString = `${xs[i]} → ${ys[i]}`;
    const { x, y } = graphPoints[i];
    const textAnchor =
      x < graphSize / 4 ? "start" : x < (3 * graphSize) / 4 ? "middle" : "end";
    nodeCoordinates.push(
      svg.g({ class: "node-coords-group" }, [
        svg.line({ class: "grid", x1: x, y1: 0, x2: x, y2: graphSize }),
        svg.line({ class: "grid", x1: 0, y1: y, x2: graphSize, y2: y }),
        svg.text(
          {
            x,
            "y": -y - 6,
            "transform": svg.scale(1, -1),
            "text-anchor": textAnchor,
          },
          [coordString]
        ),
      ])
    );
  }

  return svg.svg(
    {
      width,
      height,
      viewBox: svg.viewBox(0, 0, width, height),
      tabindex: 0,
      style: "outline: none;",
    },
    [
      svg.style({}, [
        `
        .background {
          fill: #BBB2;
          cursor: initial;
        }
        .grid {
          fill: none;
          stroke: #9995;
        }
        .graph {
          stroke: #AAA;
          stroke-width: 1.5px;
          fill: none;
        }
        .graph.faded {
          opacity: 60%;
        }
        .default-line {
          transition: 200ms;
        }
        text {
          font-size: 0.8em;
        }
        .faded {
          opacity: 10%;
        }
        .node {
          r: 3.5px;
          transition: 150ms;
        }
        .node:hover {
          r: 4.5px;
        }
        .node-coords-group {
          opacity: 0%;
          transition: 200ms;
          pointer-events: none;
        }
        .node-coords-group.visible {
          opacity: 100%;
          text-shadow: 0 0 2px #DDD;
        }
      `,
      ]),
      svg.rect({ class: "background", x: 0, y: 0, width, height }),
      svg.g({ transform: svg.translate(0, height).scale(1, -1) }, [
        svg.g({ transform: svg.translate(marginLeft, marginBottom) }, [
          ...defaultLines,
          svg.rect({
            class: "grid",
            x: 0,
            y: 0,
            width: graphSize,
            height: graphSize,
          }),
          graphElement,
          ...nodes,
          ...nodeCoordinates,
          svg.g(
            { transform: svg.translate(0, labelOffset) },
            graphLabels(xMin, "user", xMax)
          ),
          svg.g(
            {
              transform: svg
                .translate(graphSize, 0)
                .rotate(90)
                .translate(0, labelOffset),
            },
            graphLabels(yMin, "source", yMax)
          ),
        ]),
      ]),
    ]
  );
}
function buildMappingList(axisController) {
  const axis = axisController.model;

  const items = axis.mapping.map(([user, source]) => {
    return { user, source };
  });
  const mappingList = new UIList();
  mappingList.classList.add("fontra-ui-font-info-axes-panel-axis-box-mapping-list");
  mappingList.columnDescriptions = [
    {
      key: "user",
      title: "User",
      width: "3em",
    },
    { key: "source", title: "Source", width: "3em" },
  ];
  mappingList.showHeader = true;
  mappingList.minHeight = "5em";
  mappingList.setItems(items);
  return mappingList;
}