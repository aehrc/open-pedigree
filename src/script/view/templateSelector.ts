import PedigreeTemplates from 'pedigree/view/templates';
import { NativeModal } from 'pedigree/view/nativeModal';

/**
 * The UI Element for browsing and selecting pre-defined Pedigree templates
 *
 * @class TemplateSelector
 * @constructor
 * @param {Boolean} isStartupTemplateSelector Set to True if no pedigree has been loaded yet
 */

export default class TemplateSelector {
  _isStartupTemplateSelector: any;
  mainDiv: any;
  dialog: any;

  constructor(isStartupTemplateSelector?: any) {
    this._isStartupTemplateSelector = isStartupTemplateSelector;
    this.mainDiv = document.createElement('div');
    this.mainDiv.className = 'template-picture-container';
    this.mainDiv.textContent = 'Loading list of templates...';
    const closeShortcut = isStartupTemplateSelector ? [] : ['Esc'];
    this.dialog = new NativeModal(this.mainDiv, {close: {method : this.hide.bind(this), keys : closeShortcut}}, {extraClassName: 'pedigree-template-chooser', title: 'Please select a pedigree template', displayCloseButton: !isStartupTemplateSelector, verticalPosition: 'top'});
    isStartupTemplateSelector && this.dialog.show();

    this.mainDiv.replaceChildren();

    for (let i = 0; i < PedigreeTemplates.length; ++i) {
      const pictureBox = document.createElement('div');
      pictureBox.className = 'picture-box';
      pictureBox.textContent = 'Loading...';
      this.mainDiv.appendChild(pictureBox);
      const template = PedigreeTemplates[i];
      (pictureBox as any).pedigreeData = JSON.stringify(template.data);
      (pictureBox as any).description  = template.description;
      pictureBox.title = (pictureBox as any).description;

      // TODO: render images with JavaScript instead
      if (window.SVGSVGElement &&
                document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#Image', '1.1')) {
        pictureBox.innerHTML = template.image;
      } else {
        pictureBox.innerHTML = '<table bgcolor=\'#FFFAFA\'><tr><td><br>&nbsp;' + (pictureBox as any).description + '&nbsp;<br><br></td></tr></table>';
      }
      pictureBox.addEventListener('click', (event: any) => this._onTemplateSelected(event, pictureBox));
    }
  }

  /**
   * Returns True if this template selector is the one displayed on startup
   *
   * @method isStartupTemplateSelector
   * @return {Boolean}
   */
  isStartupTemplateSelector(): any {
    return this._isStartupTemplateSelector;
  }

  /**
   * Loads the template once it has been selected
   *
   * @param event
   * @param pictureBox
   * @private
   */
  _onTemplateSelected(event: any, pictureBox: any): void {
    this.dialog.close();
    editor.getSaveLoadEngine().createGraphFromSerializedData(pictureBox.pedigreeData, false /* add to undo stack */, true /*center around 0*/);
  }

  /**
   * Displays the template selector
   *
   * @method show
   */
  show(): void {
    this.dialog.show();
  }

  /**
   * Removes the the template selector
   *
   * @method hide
   */
  hide(): void {
    this.dialog.closeDialog();
  }
}
