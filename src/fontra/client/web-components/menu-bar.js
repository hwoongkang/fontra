import * as html from "../core/html-utils.js";
import { SimpleElement } from "../core/html-utils.js";
import { MenuPanel } from "./menu-panel.js";

export class MenuBar extends SimpleElement {
  static styles = `
  .menu-bar {
    padding: 0.5rem 1rem;
    align-items: center;
    position: absolute;
    font-size: 1rem;
    width: 100%;
  }

  .menu-item {
    padding: 0.5rem 1rem;
    display: inline-block;
    cursor: default;
    user-select: none;
  }

  .menu-item:hover,
  .menu-item.current {
    background: #e1e1e1;
    border-radius: 5px;
  }
  `;

  constructor(items = []) {
    super();
    this.items = items;
    this.contentElement = this.shadowRoot.appendChild(html.div());
    this.contentElement.classList.add("menu-bar");
    this.render();
    window.addEventListener("mousedown", this.onBlur.bind(this));
    window.addEventListener("blur", this.onBlur.bind(this));
    this.contentElement.addEventListener("mouseover", this.onMouseover.bind(this));
    this.contentElement.addEventListener("click", this.onClick.bind(this));
    this.showMenuWhenHover = false;
  }

  onClick(event) {
    if (event.target.classList.contains("menu-item")) {
      for (let i = 0; i < this.contentElement.childElementCount; i++) {
        const node = this.contentElement.childNodes[i];
        if (node === event.target) {
          this.clearCurrentSelection();
          this.showMenuWhenHover = true;
          this.showMenu(this.items[i].getItems(), node);
          break;
        }
      }
    }
  }

  onMouseover(event) {
    if (event.target === this.contentElement) {
      this.clearCurrentSelection();
      return;
    }
    if (event.target.classList.contains("menu-item")) {
      this.clearCurrentSelection();
      for (let i = 0; i < this.contentElement.childElementCount; i++) {
        const node = this.contentElement.childNodes[i];
        if (node === event.target) {
          if (this.showMenuWhenHover) {
            this.showMenu(this.items[i].getItems(), node);
          }
          break;
        }
      }
    }
  }

  onBlur() {
    this.clearCurrentSelection();
    this.showMenuWhenHover = false;
  }

  clearCurrentSelection(event) {
    const currentSelection = this.contentElement.querySelector(".current");
    if (currentSelection) {
      currentSelection.classList.remove("current");
      const menuPanel = this.contentElement.querySelector("menu-panel");
      if (menuPanel) {
        this.contentElement.removeChild(menuPanel);
      }
    }
  }

  showMenu(items, menuItemElement) {
    menuItemElement.classList.add("current");
    const clientRect = menuItemElement.getBoundingClientRect();
    const position = {
      x: clientRect.x,
      y: clientRect.y + clientRect.height,
    };
    const menuPanel = new MenuPanel(items, position, undefined, () => {
      this.showMenuWhenHover = false;
      this.clearCurrentSelection();
    });
    this.contentElement.appendChild(menuPanel);
  }

  render() {
    const fragment = document.createDocumentFragment();
    for (const item of this.items) {
      fragment.appendChild(html.div({ class: "menu-item" }, [item.title]));
    }
    this.contentElement.appendChild(fragment);
  }
}

customElements.define("menu-bar", MenuBar);
