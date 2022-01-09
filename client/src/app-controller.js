import { CanvasController } from "./canvas-controller.js";
import { SceneController } from "./scene-controller.js"
import * as sceneDraw from "./scene-draw-funcs.js";
import { SceneModel } from "./scene-model.js";
import { SceneView } from "./scene-view.js"
import { List } from "./ui-list.js";
import { Sliders } from "./ui-sliders.js";


const drawingParametersLight = {
  nodeFillColor: "#CCC",
  nodeSize: 8,
  handleColor: "#CCC",
  handleLineWidth: 1,
  selection: {
    nodeSize: 10,
    nodeColor: "#000",
    nodeLineWidth: 2,
    componentFillColor: "#000"
  },
  hover: {
    nodeSize: 10,
    nodeColor: "#444",
    nodeLineWidth: 2,
    componentFillColor: "#444"
  },
  pathStrokeColor: "#000",
  pathLineWidth: 1,
  componentFillColor: "#222",
  rectSelectLineWidth: 1,
  rectSelectLineDash: [10, 10],
}


const drawingParametersDark = {
  nodeFillColor: "#777",
  nodeSize: 8,
  handleColor: "#777",
  handleLineWidth: 1,
  selection: {
    nodeSize: 10,
    nodeColor: "#FFF",
    nodeLineWidth: 2,
    componentFillColor: "#FFF"
  },
  hover: {
    nodeSize: 10,
    nodeColor: "#DDD",
    nodeLineWidth: 2,
    componentFillColor: "#DDD"
  },
  pathStrokeColor: "#FFF",
  pathLineWidth: 1,
  componentFillColor: "#CCC",
  rectSelectLineWidth: 1,
  rectSelectLineDash: [10, 10],
}


export class AppController {

  constructor(font) {
    this.font = font;
    const canvas = document.querySelector("#edit-canvas");

    const canvasController = new CanvasController(canvas, this.drawingParameters);
    // We need to do isPointInPath without having a context, we'll pass a bound method
    const isPointInPath = canvasController.context.isPointInPath.bind(canvasController.context);

    const sceneModel = new SceneModel(font, isPointInPath);
    const drawFuncs = [
      sceneDraw.drawComponentsLayer,
      sceneDraw.drawHandlesLayer,
      sceneDraw.drawNodesLayer,
      sceneDraw.drawPathLayer,
      sceneDraw.drawSelectionLayer,
      sceneDraw.drawHoverLayer,
      sceneDraw.drawRectangleSelectionLayer,
    ]
    const sceneView = new SceneView();
    sceneView.subviews = drawFuncs.map(
      drawFunc => new SceneView(sceneModel, drawFunc)
    );
    canvasController.sceneView = sceneView;

    this.sceneController = new SceneController(sceneModel, canvasController)

    this.initOverlayItems(canvas);
    this.initMiniConsole();

    window.matchMedia("(prefers-color-scheme: dark)").addListener(event => this.themeChanged(event));
  }

  async start() {
    await this.initGlyphNames();
    this.initSliders();
    this.initSourcesList();
  }

  async initGlyphNames() {
    const columnDescriptions = [
      {"key": "char", "width": "2em", "get": item => getCharFromUnicode(item.unicodes[0])},
      {"key": "glyphName", "width": "10em", },
      {"key": "unicode", "width": "5em", "get": item => getUniStringFromUnicode(item.unicodes[0])},
    ];
    this.glyphNamesList = new List("glyphs-list", columnDescriptions);
    this.glyphNamesList.addEventListener("listSelectionChanged", async event => {
      const list = event.detail;
      const item = list.items[list.selectedItemIndex];
      await this.glyphNameChangedCallback(item.glyphName);
    });
    this.reversedCmap = await this.font.getReversedCmap();
    this.cmap = makeCmapFromReversedCmap(this.reversedCmap);
    this.glyphsListItems = [];
    for (const glyphName in this.reversedCmap) {
      this.glyphsListItems.push({"glyphName": glyphName, "unicodes": this.reversedCmap[glyphName]});
    }
    this.glyphsListItems.sort(glyphItemSortFunc);
    this.glyphNamesList.setItems(this.glyphsListItems);
  }

  initSliders() {
    this.sliders = new Sliders("axis-sliders", []);
    this.sliders.addEventListener("slidersChanged", async event => {
      await this.sceneController.setAxisValues(event.detail.values);
      this.sourcesList.setSelectedItemIndex(this.sceneController.currentSourceIndex, false);
    });
  }

  initSourcesList() {
    const columnDescriptions = [
      {"key": "sourceName", "width": "12em"},
      // {"key": "sourceIndex", "width": "2em"},
    ];
    this.sourcesList = new List("sources-list", columnDescriptions);
    this.sourcesList.addEventListener("listSelectionChanged", async event => {
      await this.sceneController.setSelectedSource(event.detail.getSelectedItem());
      this.sliders.values = this.sceneController.getAxisValues();
    });
  }

  initOverlayItems(canvas) {
    const overlayItems = Array.from(document.querySelectorAll(".overlay-item"));
    const textEntryElement = document.querySelector("#text-entry");

    const collapseAll = () => {
      for (const item of overlayItems) {
        item.classList.remove("overlay-item-expanded");
      }
    }

    const collapseOnEscapeKey = event => {
      if (event.key === "Escape") {
        collapseAll();
      }
    }

    textEntryElement.oninput = event => {
      console.log(event.target.textContent);
      const glyphNames = glyphNamesFromText(event.target.textContent, this.cmap);
      console.log(glyphNames);
    }

    for (const item of overlayItems) {
      item.onkeydown = event => collapseOnEscapeKey(event);
      item.onclick = event => {
        if (overlayItems.indexOf(event.target) == -1) {
          return;
        }
        for (const item of overlayItems) {
          item.classList.toggle("overlay-item-expanded", item === event.target);
          if (item === event.target && item.id === "text-entry-overlay") {
            textEntryElement.focus();
          }
        }
      };
    }

    canvas.addEventListener("mousedown", event => collapseAll());
    window.addEventListener("keydown", event => collapseOnEscapeKey(event));
  }

  initMiniConsole() {
    this.miniConsole = document.querySelector("#mini-console");
    this._console_log = console.log.bind(console);
    console.log = (...args) => {
      this._console_log(...args);
      this.miniConsole.innerText = args.map(
        item => typeof item == "string" ? item : JSON.stringify(item)
      ).join(" ");
      this.miniConsole.style.display = "inherit";
      if (this._miniConsoleClearTimeoutID) {
        clearTimeout(this._miniConsoleClearTimeoutID);
      }
      this._miniConsoleClearTimeoutID = setTimeout(() => {
        this.miniConsole.innerText = "";
        this.miniConsole.style.display = "none";
        delete this._miniConsoleClearTimeoutID;
      }, 5000);
    }
  }

  themeChanged(event) {
    const isDark = event.matches;
    this.sceneController.setDrawingParameters(this.drawingParameters);
  }

  get isThemeDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  get drawingParameters() {
    return this.isThemeDark ? drawingParametersDark : drawingParametersLight;
  }

  async glyphSeachFieldChanged(value) {
    const filteredGlyphItems = this.glyphsListItems.filter(item => glyphFilterFunc(item, value));
    const selectedItem = this.glyphNamesList.getSelectedItem();
    this.glyphNamesList.setItems(filteredGlyphItems);
    this.glyphNamesList.setSelectedItem(selectedItem);
  }

  async glyphNameChangedCallback(glyphName) {
    const didSetGlyph = await this.sceneController.setSelectedGlyph(glyphName);
    if (!didSetGlyph) {
      return;
    }
    this.sliders.setSliderDescriptions(this.sceneController.getAxisInfo());
    this.sourcesList.setItems(this.sceneController.getSourcesInfo());
    this.sliders.values = this.sceneController.getAxisValues();
    this.sourcesList.setSelectedItemIndex(this.sceneController.currentSourceIndex, false);
  }

}


function getCharFromUnicode(codePoint) {
  return codePoint !== undefined ? String.fromCodePoint(codePoint) : ""

}


function getUniStringFromUnicode(codePoint) {
  return codePoint !== undefined ? "U+" + codePoint.toString(16).toUpperCase().padStart(4, "0") : ""
}


function glyphItemSortFunc(item1, item2) {
  const uniCmp = compare(item1.unicodes[0], item2.unicodes[0]);
  const glyphNameCmp = compare(item1.glyphName, item2.glyphName);
  return uniCmp ? uniCmp : glyphNameCmp;
}


function glyphFilterFunc(item, searchString) {
  if (item.glyphName.indexOf(searchString) >= 0) {
    return true;
  }
  if (item.unicodes[0] !== undefined) {
    const char = String.fromCodePoint(item.unicodes[0]);
    if (searchString.indexOf(char) >= 0) {
      return true;
    }
  }
  return false;
}


// utils, should perhaps move to utils.js

function compare(a, b) {
  // sort undefined at the end
  if (a === b) {
    return 0;
  } else if (a === undefined) {
    return 1;
  } else if (b === undefined) {
    return -1;
  } else if (a < b) {
    return -1;
  } else {
    return 1;
  }
}


function makeCmapFromReversedCmap(reversedCmap) {
  const cmap = {};
  for (const [glyphName, codePoints] of Object.entries(reversedCmap)) {
    for (const codePoint of codePoints) {
      const mappedGlyphName = cmap[codePoint];
      if (mappedGlyphName !== undefined && glyphName > mappedGlyphName) {
        continue;
      }
      cmap[codePoint] = glyphName;
    }
  }
  return cmap;
}


function glyphNamesFromText(text, cmap) {
  const glyphNames = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    glyphNames.push(cmap[char.charCodeAt(0)]);
  }
  return glyphNames;
}
