/**
 * NodeMenu is a UI Element containing options for AbstractNode elements
 *
 * @class NodeMenu
 * @constructor
 * @param {Array} data Contains objects corresponding to different menu items
 *
 {
 [
    {
        'name' : the name of the menu item,
        'label' : the text label above this menu option,
        'type' : the type of form input. (eg. 'radio', 'date-picker', 'text', 'textarea', 'disease-picker', 'select'),
        'values' : [
                    {'actual' : actual value of the option, 'displayed' : the way the option will be seen in the menu} ...
                    ]
    }, ...
 ]
 }

 Note: when an item is specified as "inactive" it is completely removed from the menu; when it
       is specified as "disabled" it is greyed-out and does not allow selection, but is still visible.
 */

import flatpickr from 'flatpickr';
import jQuery from 'jquery';

var SELECTIZE_DELIMITER = '|';

// Tabs may be passed either as a plain string (legacy) or as {key, label} (questionnaire-source-of-truth
// tab derivation - see design D13), so two tabs can share a display label without colliding internally.
function tabKey(tab: any): any {
  return (tab && typeof tab === 'object') ? tab.key : tab;
}
function tabLabel(tab: any): any {
  return (tab && typeof tab === 'object') ? tab.label : tab;
}

// Colours each currently-selected Selectize "item" chip with a small swatch bubble, reading
// the colour from the given legend. Selectize rebuilds its .item elements from scratch on every
// setValue()/refreshOptions() call, so this must be re-applied every time a field's value is set
// (menu open, node switch, etc.) - a one-time colour-assignment event alone isn't enough, since
// the swatch it adds would be wiped out the next time the field re-renders. `container` is
// expected to be the field's own field-box element, so a plain descendant query is already
// correctly scoped to this one field (no risk of matching another field's chips).
function applySelectizeSwatches(container: any, legend: any): void {
  if (!legend) {
    return;
  }
  Array.from(container.querySelectorAll('.item[data-value]')).forEach(function(item: any) {
    var value = item.dataset.value;
    var colorBubble = item.querySelector('.disorder-color');
    if (!colorBubble) {
      colorBubble = document.createElement('span');
      colorBubble.className = 'disorder-color';
      item.prepend(colorBubble);
    }
    colorBubble.style.background = legend.getObjectColor(value);
  });
}

export default class NodeMenu {
  canvas: any;
  menuBox: any;
  closeButton: any;
  form: any;
  tabs: any;
  tabHeaders: any;
  tabTop: any;
  singleTab: any;
  fieldMap: any;
  targetNode: any;
  _onscreen: any;
  _updating: any;
  _updateDisorderColor: any;
  _updateGeneColor: any;
  _updateQuestionnaireLegendColor: any;

  constructor(data: any, tabs: any, otherCSSClass?: any) {
    this.canvas = editor.getWorkspace().canvas || document.body;
    var cssClass = 'menu-box';
    if (otherCSSClass) {
      cssClass += ' ' + otherCSSClass;
    }
    this.menuBox = document.createElement('div');
    this.menuBox.className = cssClass;

    this.closeButton = document.createElement('span');
    this.closeButton.className = 'close-button';
    this.closeButton.textContent = '×';
    this.menuBox.prepend(this.closeButton);
    this.closeButton.addEventListener('click', this.hide.bind(this));

    this.form = document.createElement('form');
    this.form.method = 'get';
    this.form.action = '';
    this.form.className = 'tabs-content';

    this.tabs = {};
    this.tabHeaders = {};
    if (tabs && tabs.length > 0) {
      this.tabTop = document.createElement('dl');
      this.tabTop.className = 'tabs';
      for (var i = 0; i < tabs.length; i++) {
        var tabName = tabKey(tabs[i]);
        var tabDisplayLabel = tabLabel(tabs[i]);
        var activeClass = (i == 0) ? 'active' : '';
        this.tabs[tabName] = document.createElement('div');
        this.tabs[tabName].id = 'tab_' + tabName;
        this.tabs[tabName].className = 'content ' + activeClass;
        this.form.appendChild(this.tabs[tabName]);

        this.tabHeaders[tabName] = document.createElement('dd');
        this.tabHeaders[tabName].className = activeClass;
        this.tabHeaders[tabName].innerHTML = '<a>' + tabDisplayLabel + '</a>';
        var _this = this;
        var switchTab = function(tabName: any) {
          return function() {
            for (var tab in _this.tabs) {
              if (_this.tabs.hasOwnProperty(tab)) {
                if (tab != tabName) {
                  _this.tabs[tab].className = 'content';
                  _this.tabHeaders[tab].className = '';
                } else {
                  _this.tabs[tab].className = 'content active';
                  _this.tabHeaders[tab].className = 'active';
                }
              }
            }
            _this.reposition();
          };
        };
        this.tabHeaders[tabName].addEventListener('click', switchTab(tabName));
        this.tabTop.appendChild(this.tabHeaders[tabName]);
      }
      var div = document.createElement('div');
      div.className = 'tabholder';
      div.appendChild(this.tabTop);
      div.appendChild(this.form);
      this.menuBox.appendChild(div);
    } else {
      this.singleTab = document.createElement('div');
      this.singleTab.className = 'tabholder';
      this.singleTab.appendChild(this.form);
      this.menuBox.appendChild(this.singleTab);
      this.closeButton.classList.add('close-button-old');
      this.form.classList.add('content');
    }

    this.fieldMap = {};
    // Generate fields
    var _this = this;
    data.forEach(function(d: any) {
      if (typeof ((_this._generateField as any)[d.type]) == 'function') {
        var insertLocation = _this.form;
        var key = tabKey(d.tab);
        if (key && _this.tabs.hasOwnProperty(key)) {
          insertLocation = _this.tabs[key];
        }
        insertLocation.appendChild((_this._generateField as any)[d.type].call(_this, d));
      }
    });

    // Insert in document
    this.hide();
    editor.getWorkspace().getWorkArea().appendChild(this.menuBox);

    (this as any)._onClickOutside = this._onClickOutside.bind(this);

    // Date pickers are initialised per-field in _generateField['date-picker'] using flatpickr.

    this._initializeSuggestPickers();

    // Update disorder colors. Handles the live case (a brand-new colour assigned while this
    // field's Selectize items are already rendered) - the same swatch application also runs
    // unconditionally on every value-set in _setFieldValue['disease-picker'], since Selectize
    // rebuilds its .item elements from scratch each time and would otherwise wipe this out.
    this._updateDisorderColor = function(this: any, id: any, color: any) {
      Array.from(this.menuBox.querySelectorAll('.field-disorders .item[data-value="' + id + '"]')).forEach(function(item: any) {
        var colorBubble = item.querySelector('.disorder-color');
        if (!colorBubble) {
          colorBubble = document.createElement('span');
          colorBubble.className = 'disorder-color';
          item.prepend(colorBubble);
        }
        colorBubble.style.background = color;
      });
    }.bind(this);
    document.addEventListener('disorder:color', function(event: any) {
      if (!event.detail || !event.detail.id || !event.detail.color) {
        return;
      }
      _this._updateDisorderColor(event.detail.id, event.detail.color);
    });

    // Update gene colors (see disorder colors above for why this is also applied unconditionally
    // in _setFieldValue['gene-picker']).
    this._updateGeneColor = function(this: any, id: any, color: any) {
      Array.from(this.menuBox.querySelectorAll('.field-candidate_genes .item[data-value="' + id + '"]')).forEach(function(item: any) {
        var colorBubble = item.querySelector('.disorder-color');
        if (!colorBubble) {
          colorBubble = document.createElement('span');
          colorBubble.className = 'disorder-color';
          item.prepend(colorBubble);
        }
        colorBubble.style.background = color;
      });
    }.bind(this);
    document.addEventListener('gene:color', function(event: any) {
      if (!event.detail || !event.detail.id || !event.detail.color) {
        return;
      }
      _this._updateGeneColor(event.detail.id, event.detail.color);
    });

    // Update questionnaire-legend-picker colors (generic - any linkId). Legend instances used
    // here are constructed with idPrefix 'legend-<linkId>' (see PedigreeEditor.getQuestionnaireLegend),
    // while the field's own CSS class is 'field-<linkId>' (see PedigreeEditor._buildFieldDescriptors) -
    // strip the 'legend-' prefix to go from one to the other. (See disorder colors above for why
    // this is also applied unconditionally in _setFieldValue['questionnaire-legend-picker'].)
    this._updateQuestionnaireLegendColor = function(this: any, linkId: any, id: any, color: any) {
      var fieldLinkId = String(linkId).replace(/^legend-/, '');
      Array.from(this.menuBox.querySelectorAll('.field-' + fieldLinkId + ' .item[data-value="' + id + '"]')).forEach(function(item: any) {
        var colorBubble = item.querySelector('.disorder-color');
        if (!colorBubble) {
          colorBubble = document.createElement('span');
          colorBubble.className = 'disorder-color';
          item.prepend(colorBubble);
        }
        colorBubble.style.background = color;
      });
    }.bind(this);
    document.addEventListener('questionnaire-legend:color', function(event: any) {
      if (!event.detail || !event.detail.linkId || !event.detail.id || !event.detail.color) {
        return;
      }
      _this._updateQuestionnaireLegendColor(event.detail.linkId, event.detail.id, event.detail.color);
    });
  }

  /**
   * Wires up Selectize on every not-yet-initialized suggest-picker <select> in the form
   * (disorders/genes/phenotypes via their Legend, questionnaire choice fields via their
   * per-linkId terminology instance). Safe to call repeatedly - already-initialized
   * elements (marked with the 'initialized' class) are skipped.
   */
  _initializeSuggestPickers(): void {
    var _createSuggest = function(input: any, termType: any, selectizeOptions: any) {
      var jqnode = jQuery(input);
      if (jqnode) {
        jqnode.selectize({
          options: [],
          create: true,
          sortField: 'text',
          persist: true,
          maxItems: null,
          delimiter: SELECTIZE_DELIMITER,
          onChange : () => {
            for (const v of jqnode[0].selectize.getValue()){
              const item = jqnode[0].selectize.getItem(v);
              const name = item.text();
              editor.getLegend(termType).addToCache(v, name);
            }
            input.dispatchEvent(new CustomEvent('xwiki:customchange'));
          },
          load: (query: any, callback: any) => {
            if (query.length < 2) return callback();
            editor.getLegend(termType).searchForTerms(query,
              (search: any, result: any) => callback(result),
              (err: any) => callback()
            );
          },
          ...selectizeOptions
        });
      }
      return jqnode;
    };

    // disease
    Array.from(this.form.querySelectorAll('select.suggest-omim')).forEach(function(item: any) {
      if (!item.classList.contains('initialized')) {
        _createSuggest(item, 'disorder', undefined);
        item.classList.add('initialized');
      }
    });

    // genes
    Array.from(this.form.querySelectorAll('select.suggest-genes')).forEach(function(item: any) {
      if (!item.classList.contains('initialized')) {
        _createSuggest(item, 'gene', undefined);
        item.classList.add('initialized');
      }
    });

    // phenotype terms
    Array.from(this.form.querySelectorAll('select.suggest-hpo')).forEach(function(item: any) {
      if (!item.classList.contains('initialized')) {
        _createSuggest(item, 'phenotype', undefined);
        item.classList.add('initialized');
      }
    });

    // questionnaire answerValueSet-backed choice fields - one terminology instance per linkId,
    // not routed through a Legend (no color-swatch/id-cache concept needed here)
    var _createQuestionnaireSuggest = function(input: any, linkId: any) {
      var jqnode = jQuery(input);
      if (jqnode) {
        jqnode.selectize({
          options: [],
          create: false,
          sortField: 'text',
          persist: true,
          maxItems: input.multiple ? null : 1,
          delimiter: SELECTIZE_DELIMITER,
          onChange: () => {
            input.dispatchEvent(new CustomEvent('xwiki:customchange'));
          },
          load: (query: any, callback: any) => {
            if (query.length < 2) return callback();
            var terminology = editor.getQuestionnaireTerminology && editor.getQuestionnaireTerminology(linkId);
            if (!terminology) return callback();
            terminology.searchForTerms(query,
              (search: any, result: any) => callback(result),
              (err: any) => callback()
            );
          }
        });
      }
      return jqnode;
    };
    Array.from(this.form.querySelectorAll('select.suggest-questionnaire')).forEach(function(item: any) {
      if (!item.classList.contains('initialized')) {
        _createQuestionnaireSuggest(item, item.dataset.linkid);
        item.classList.add('initialized');
      }
    });

    // legend-backed Questionnaire items (mapsToLegendCondition/mapsToLegendObservation) -
    // same terminology-backed search as suggest-questionnaire, but caches selected terms into
    // the item's own Legend (via getQuestionnaireLegend) on change, same as disease/gene/hpo pickers.
    var _createQuestionnaireLegendSuggest = function(input: any, linkId: any) {
      var jqnode = jQuery(input);
      if (jqnode) {
        jqnode.selectize({
          options: [],
          create: false,
          sortField: 'text',
          persist: true,
          maxItems: null,
          delimiter: SELECTIZE_DELIMITER,
          onChange: () => {
            var legend = editor.getQuestionnaireLegend && editor.getQuestionnaireLegend(linkId);
            if (legend) {
              for (const v of jqnode[0].selectize.getValue()) {
                const item = jqnode[0].selectize.getItem(v);
                const name = item.text();
                legend.addToCache(v, name);
              }
            }
            input.dispatchEvent(new CustomEvent('xwiki:customchange'));
          },
          load: (query: any, callback: any) => {
            if (query.length < 2) return callback();
            var terminology = editor.getQuestionnaireTerminology && editor.getQuestionnaireTerminology(linkId);
            if (!terminology) return callback();
            terminology.searchForTerms(query,
              (search: any, result: any) => callback(result),
              (err: any) => callback()
            );
          }
        });
      }
      return jqnode;
    };
    Array.from(this.form.querySelectorAll('select.suggest-questionnaire-legend')).forEach(function(item: any) {
      if (!item.classList.contains('initialized')) {
        _createQuestionnaireLegendSuggest(item, item.dataset.linkid);
        item.classList.add('initialized');
      }
    });
  }

  _generateEmptyField(data: any): any {
    var result = document.createElement('div');
    result.className = 'field-box field-' + data.name;
    var label = document.createElement('label');
    label.className = 'field-name';
    label.textContent = data.label;
    (result as any).inputsContainer = document.createElement('div');
    (result as any).inputsContainer.className = 'field-inputs';
    result.appendChild(label);
    result.appendChild((result as any).inputsContainer);
    this.fieldMap[data.name] = {
      'type' : data.type,
      'element' : result,
      'default' : data['default'] || '',
      'crtValue' : data['default'] || '',
      'function' : data['function'],
      'inactive' : false
    };
    return result;
  }

  _attachFieldEventListeners(field: any, eventNames: any, values?: any): any {
    var _this = this;
    eventNames.forEach(function(eventName: any) {
      field.addEventListener(eventName, function(event: any) {
        if (_this._updating) {
          return;
        } // otherwise a field change triggers an update which triggers field change etc
        var target = _this.targetNode;
        if (!target) {
          console.log('Attempted to update field without focus on a node');
          return;
        }

        var newValue = field._getValue && field._getValue() || undefined;
        if (Array.isArray(newValue)) {
          _this.fieldMap[field.name].crtValue = newValue[0];
        } else {
          console.log('Received invalid field value ' + newValue + ' for field ' + field.name);
          return;
        }

        var method = _this.fieldMap[field.name]['function'];

        if (target.getSummary()[field.name].value == _this.fieldMap[field.name].crtValue) {
          return;
        }

        if (method.indexOf('set') == 0 && typeof(target[method]) == 'function') {
          var properties: any = {};
          properties[method] = _this.fieldMap[field.name].crtValue;
          var fireEvent: any = { 'nodeID': target.getID(), 'properties': properties };
          document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: fireEvent }));
        } else {
          var properties: any = {};
          properties[method] = _this.fieldMap[field.name].crtValue;
          var fireEvent: any = { 'nodeID': target.getID(), 'modifications': properties };
          document.dispatchEvent(new CustomEvent('pedigree:node:modify', { detail: fireEvent }));
        }
        field.dispatchEvent(new Event('pedigree:change'));
      });
    });
  }

  update(): any {
    if (this.targetNode) {
      this._updating = true;   // needed to avoid infinite loop: update -> _attachFieldEventListeners -> update -> ...
      this._setCrtData(this.targetNode.getSummary());
      this.reposition();
      delete this._updating;
    }
  }

  _generateField: any = {
    'radio' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var columnClass = data.columns ? 'field-values-' + data.columns + '-columns' : 'field-values';
      var values = document.createElement('div');
      values.className = columnClass;
      result.inputsContainer.appendChild(values);
      var _this = this;
      var _generateRadioButton = function(v: any) {
        var radioLabel = document.createElement('label');
        radioLabel.className = data.name + '_' + v.actual;
        radioLabel.textContent = v.displayed;
        var radioButton = document.createElement('input');
        radioButton.type = 'radio';
        radioButton.name = data.name;
        radioButton.value = v.actual;
        radioLabel.prepend(radioButton);
        (radioButton as any)._getValue = function(this: any) {
          return [this.value];
        }.bind(radioButton);
        values.appendChild(radioLabel);
        _this._attachFieldEventListeners(radioButton, ['click']);
      };
      data.values.forEach(_generateRadioButton);

      return result;
    },
    'checkbox' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = data.name;
      checkbox.value = '1';
      result.querySelector('label').prepend(checkbox);
      (checkbox as any)._getValue = function(this: any) {
        return [(this as any).checked];
      }.bind(checkbox);
      this._attachFieldEventListeners(checkbox, ['click']);
      return result;
    },
    'text' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var text = document.createElement('input');
      text.type = 'text';
      text.name = data.name;
      if (data.tip) {
        (text as any).placeholder = data.tip;
      }
      var textSpan = document.createElement('span');
      textSpan.appendChild(text);
      result.inputsContainer.appendChild(textSpan);
      (text as any)._getValue = function(this: any) {
        return [(this as any).value];
      }.bind(text);
      //this._attachFieldEventListeners(text, ['keypress', 'keyup'], [true]);
      this._attachFieldEventListeners(text, ['keyup'], [true]);
      return result;
    },
    'textarea' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var text = document.createElement('textarea');
      text.name = data.name;
      text.className = 'textarea-' + data.rows + '-rows';
      result.inputsContainer.appendChild(text);
      //text.wrap('span');
      (text as any)._getValue = function(this: any) {
        return [(this as any).value];
      }.bind(text);
      this._attachFieldEventListeners(text, ['keyup'], [true]);
      return result;
    },
    'date-picker' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var datePicker = document.createElement('input');
      datePicker.type = 'text';
      datePicker.className = 'xwiki-date';
      datePicker.name = data.name;
      datePicker.title = data.format || 'dd MMM yyyy';
      (datePicker as any).alt = '';
      result.appendChild(datePicker);
      flatpickr(datePicker as any, {
        dateFormat: 'Y-m-d',
        allowInput: true,
        position: 'above',
        onChange: function(selectedDates: any, dateStr: string) {
          (datePicker as any).alt = dateStr;
          datePicker.dispatchEvent(new CustomEvent('xwiki:date:changed'));
        }
      });
      (datePicker as any)._getValue = function(this: any) {
        var iso = (this as any).alt;
        if (!iso) return [null];
        var d = new Date(iso);
        return [isNaN(d.getTime()) ? null : d];
      }.bind(datePicker);
      this._attachFieldEventListeners(datePicker, ['xwiki:date:changed']);
      return result;
    },
    'disease-picker' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var diseasePicker = document.createElement('select');
      diseasePicker.multiple = true;
      diseasePicker.className = 'suggest-omim';
      diseasePicker.name = data.name;
      result.appendChild(diseasePicker);
      (diseasePicker as any)._getValue = function(this: any) {
        var target = jQuery(this);
        if (target && target[0] && (target[0] as any).selectize) {
          var val = (target[0] as any).selectize.getValue();
          if (val) {
            return [val];
          } else {
            return [];
          }
        }
        return [];
      }.bind(diseasePicker);
      this._attachFieldEventListeners(diseasePicker, ['xwiki:customchange']);
      return result;
    },
    'hpo-picker' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var hpoPicker = document.createElement('select');
      hpoPicker.multiple = true;
      hpoPicker.className = 'suggest-hpo';
      hpoPicker.name = data.name;
      result.appendChild(hpoPicker);
      (hpoPicker as any)._getValue = function(this: any) {
        var target = jQuery(this);
        if (target && target[0] && (target[0] as any).selectize) {
          var val = (target[0] as any).selectize.getValue();
          if (val) {
            return [val];
          } else {
            return [];
          }
        }
        return [];
      }.bind(hpoPicker);
      this._attachFieldEventListeners(hpoPicker, ['xwiki:customchange']);
      return result;
    },
    'gene-picker' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var genePicker = document.createElement('select');
      genePicker.multiple = true;
      genePicker.className = 'suggest-genes';
      genePicker.name = data.name;
      result.appendChild(genePicker);
      (genePicker as any)._getValue = function(this: any) {
        var target = jQuery(this);
        if (target && target[0] && (target[0] as any).selectize) {
          var val = (target[0] as any).selectize.getValue();
          if (val) {
            return [val];
          } else {
            return [];
          }
        }
        return [];
      }.bind(genePicker);
      this._attachFieldEventListeners(genePicker, ['xwiki:customchange']);
      return result;
    },
    'select' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var select = document.createElement('select');
      select.name = data.name;
      var selectSpan = document.createElement('span');
      selectSpan.appendChild(select);
      result.inputsContainer.appendChild(selectSpan);
      var _generateSelectOption = function(v: any) {
        var option = document.createElement('option');
        option.value = v.actual;
        option.textContent = v.displayed;
        select.appendChild(option);
      };
      if(data.nullValue) {
        _generateSelectOption({'actual' : '', displayed : '-'});
      }
      if (data.values) {
        data.values.forEach(_generateSelectOption);
      } else if (data.range) {
        for (var i = data.range.start; i <= data.range.end; i++) {
          _generateSelectOption({'actual': i, 'displayed' : i + ' ' + data.range.item[+(i!=1)]});
        }
      }
      (select as any)._getValue = function(this: any) {
        return [((this as any).selectedIndex >= 0) && (this as any).options[(this as any).selectedIndex].value || ''];
      }.bind(select);
      this._attachFieldEventListeners(select, ['change']);
      return result;
    },
    'hidden' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      result.classList.add('hidden');
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = data.name;
      input.value = '';
      result.replaceChildren(input);
      return result;
    },
    'number' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var number = document.createElement('input');
      number.type = 'number';
      number.name = data.name;
      if (data.step) {
        number.step = data.step;
      }
      var numberSpan = document.createElement('span');
      numberSpan.appendChild(number);
      result.inputsContainer.appendChild(numberSpan);
      (number as any)._getValue = function(this: any) {
        if ((this as any).value === '') {
          return [null];
        }
        var parsed = Number((this as any).value);
        return [isNaN(parsed) ? null : parsed];
      }.bind(number);
      this._attachFieldEventListeners(number, ['keyup', 'change'], [true]);
      return result;
    },
    'heading' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      result.classList.add('field-heading');
      return result;
    },
    'questionnaire-choice-picker' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var picker = document.createElement('select');
      picker.multiple = !!data.repeats;
      picker.className = 'suggest-questionnaire';
      picker.name = data.name;
      (picker as any).dataset.linkid = data.linkId;
      result.appendChild(picker);
      (picker as any)._getValue = function(this: any) {
        var target = jQuery(this);
        if (target && target[0] && (target[0] as any).selectize) {
          var selectizeInstance = (target[0] as any).selectize;
          var ids = selectizeInstance.getValue();
          if (!ids || (Array.isArray(ids) && ids.length === 0) || ids === '') {
            return [data.repeats ? [] : null];
          }
          var idList = data.repeats ? ids : [ids];
          var answers = idList.map(function(id: any) {
            var option = selectizeInstance.options[id];
            return option ? { system: option.system, code: option.value, display: option.text } : { code: id, display: id };
          });
          return [data.repeats ? answers : answers[0]];
        }
        return [data.repeats ? [] : null];
      }.bind(picker);
      this._attachFieldEventListeners(picker, ['xwiki:customchange']);
      return result;
    },
    'button-action': function(this: any, data: any) {
      var _menu = this;
      var result = this._generateEmptyField(data);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = data.buttonLabel || data.label || '';
      btn.addEventListener('click', () => { if (data.action) data.action(_menu); });
      result.inputsContainer.appendChild(btn);
      return result;
    },
    'questionnaire-legend-picker' : function(this: any, data: any): any {
      var result = this._generateEmptyField(data);
      var picker = document.createElement('select');
      picker.multiple = true;
      picker.className = 'suggest-questionnaire-legend';
      picker.name = data.name;
      (picker as any).dataset.linkid = data.linkId;
      result.appendChild(picker);
      (picker as any)._getValue = function(this: any) {
        var target = jQuery(this);
        if (target && target[0] && (target[0] as any).selectize) {
          var selectizeInstance = (target[0] as any).selectize;
          var ids = selectizeInstance.getValue();
          if (!ids || (Array.isArray(ids) && ids.length === 0) || ids === '') {
            return [[]];
          }
          var idList = Array.isArray(ids) ? ids : [ids];
          var answers = idList.map(function(id: any) {
            var option = selectizeInstance.options[id];
            return option ? { system: option.system, code: option.value, display: option.text } : { code: id, display: id };
          });
          return [answers];
        }
        return [[]];
      }.bind(picker);
      this._attachFieldEventListeners(picker, ['xwiki:customchange']);
      return result;
    }
  };

  show(node: any, x: any, y: any): any {
    this._onscreen = true;
    this.targetNode = node;
    this._updating = true;
    this._setCrtData(node.getSummary());
    delete this._updating;
    this.menuBox.style.display = '';
    this.reposition(x, y);
    document.addEventListener('mousedown', (this as any)._onClickOutside);
  }

  hide(): any {
    this.hideSuggestPicker();
    this._onscreen = false;
    document.removeEventListener('mousedown', (this as any)._onClickOutside);
    if (this.targetNode) {
      this.targetNode.onWidgetHide();
      delete this.targetNode;
    }
    this.menuBox.style.display = 'none';
    this._clearCrtData();
  }

  hideSuggestPicker(): any {
    Array.from(this.form.querySelectorAll('select.suggest')).forEach(function(item: any) {
      if (item._suggest) {
        item._suggest.clearSuggestions();
      }
    });
  }

  isVisible(): any {
    return this._onscreen;
  }

  _onClickOutside(event: any): any {
    var target = event.target as Element;
    if (target && !target.closest('.menu-box') && !target.closest('.calendar_date_select') && !target.closest('.flatpickr-calendar') && !target.closest('.suggestItems')) {
      this.hide();
    }
  }

  reposition(x?: any, y?: any): any {
    x = Math.floor(x);
    if (x !== undefined && isFinite(x)) {
      if (this.canvas && x + this.menuBox.offsetWidth > (this.canvas.offsetWidth + 10)) {
        var delta = x + this.menuBox.offsetWidth - this.canvas.offsetWidth;
        editor.getWorkspace().panByX(delta, true);
        x -= delta;
      }
      this.menuBox.style.left = x + 'px';
    }

    this.menuBox.style.height = '';
    var height: any = '';
    var top: any    = '';
    if (y !== undefined && isFinite(y)) {
      y = Math.floor(y);
    } else {
      if (this.menuBox.style.top.length > 0) {
        y  = parseInt(this.menuBox.style.top.match( /^(\d+)/g )[0]);
      }
      if (y === undefined || !isFinite(y) || y < 0) {
        y = 0;
      }
    }

    // Make sure the menu fits inside the screen
    if (this.canvas && this.menuBox.offsetHeight >= (this.canvas.offsetHeight - 1)) {
      // menu is too big to fit the screen
      top    = 0;
      height = (this.canvas.offsetHeight - 1) + 'px';
    } else if (this.canvas.offsetHeight < y + this.menuBox.offsetHeight + 1) {
      // menu fits the screen, but have to move it higher for that
      var diff = y + this.menuBox.offsetHeight - this.canvas.offsetHeight + 1;
      var position = (y - diff);
      if (position < 0) {
        top    = 0;
        height = (this.canvas.offsetHeight - 1) + 'px';
      } else {
        top    = position + 'px';
        height = '';
      }
    } else {
      top = y + 'px';
      height = '';
    }

    this.menuBox.style.top      = top;
    this.menuBox.style.height   = height;
    this.menuBox.style.overflow = 'auto';
  }

  _clearCrtData(): any {
    var _this = this;
    Object.keys(this.fieldMap).forEach(function (name: any) {
      _this.fieldMap[name].crtValue = _this.fieldMap[name]['default'];
      (_this._setFieldValue as any)[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].crtValue);
      _this.fieldMap[name].inactive = false;
    });
  }

  _setCrtData(data: any): any {
    var _this = this;
    Object.keys(this.fieldMap).forEach(function (name: any) {
      _this.fieldMap[name].crtValue = data && data[name] && typeof(data[name].value) != 'undefined' ? data[name].value : _this.fieldMap[name].crtValue || _this.fieldMap[name]['default'];
      _this.fieldMap[name].inactive = (data && data[name] && (typeof(data[name].inactive) == 'boolean' || typeof(data[name].inactive) == 'object')) ? data[name].inactive : _this.fieldMap[name].inactive;
      _this.fieldMap[name].disabled = (data && data[name] && (typeof(data[name].disabled) == 'boolean' || typeof(data[name].disabled) == 'object')) ? data[name].disabled : _this.fieldMap[name].disabled;
      (_this._setFieldValue as any)[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].crtValue);
      (_this._setFieldInactive as any)[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].inactive);
      (_this._setFieldDisabled as any)[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].disabled);
    });
  }

  _setFieldValue: any = {
    'radio' : function(container: any, value: any): any {
      var target = container.querySelector('input[type=radio][value="' + value + '"]');
      if (target) {
        target.checked = true;
      }
    },
    'checkbox' : function(container: any, value: any): any {
      var checkbox = container.querySelector('input[type=checkbox]');
      if (checkbox) {
        checkbox.checked = value;
      }
    },
    'text' : function(container: any, value: any): any {
      var target = container.querySelector('input[type=text]');
      if (target) {
        target.value = value;
      }
    },
    'textarea' : function(container: any, value: any): any {
      var target = container.querySelector('textarea');
      if (target) {
        target.value = value;
      }
    },
    'date-picker' : function(container: any, value: any): any {
      var target = container.querySelector('input[type=text].xwiki-date');
      if (target) {
        var iso = '';
        if (value) {
          var d = (value instanceof Date) ? value : new Date(value);
          if (!isNaN(d.getTime())) {
            iso = d.toISOString().slice(0, 10);
          }
        }
        target.alt = iso;
        var fp = (target as any)._flatpickr;
        if (fp) {
          fp.setDate(iso, false);
        } else {
          target.value = iso;
        }
      }
    },
    'disease-picker' : function(container: any, values: any): any {
      var target = jQuery(container).find('select.suggest-omim');
      if (target && target[0] && (target[0] as any).selectize) {
        if (Array.isArray(values)) {
          var ids: any[] = [];
          // Diseases are an array of {id, value} objects
          values.forEach(function (value: any) {
            if (value && value.hasOwnProperty("id")) {
              ids.push(value.id);
            }
          });
          (target[0] as any).selectize.clearOptions(true);
          var currentDisorders = editor.getDisorderLegend().getCurrentTerms();
          for (var disorder of currentDisorders){
            (target[0] as any).selectize.addOption({'text': disorder.getName(), 'value': disorder.getID()});
          }
          (target[0] as any).selectize.setValue(ids, true);
          (target[0] as any).selectize.refreshOptions(false);
          applySelectizeSwatches(container, editor.getDisorderLegend());
        }
      }
    },
    'hpo-picker' : function(container: any, values: any): any {
      var target = jQuery(container).find('select.suggest-hpo');
      if (target && target[0] && (target[0] as any).selectize) {
        if (Array.isArray(values)) {
          var ids: any[] = [];
          // HPO terms are an array of {id, value} objects
          values.forEach(function (value: any) {
            if (value && value.hasOwnProperty("id")) {
              ids.push(value.id);
            }
          });
          (target[0] as any).selectize.clearOptions(true);
          var currentPhenotypes = editor.getPhenotypeLegend().getCurrentTerms();
          for (var phenotype of currentPhenotypes){
            (target[0] as any).selectize.addOption({'text': phenotype.getName(), 'value': phenotype.getID()});
          }
          (target[0] as any).selectize.setValue(ids, true);
          (target[0] as any).selectize.refreshOptions(false);
        }
      }
    },
    'gene-picker' : function(container: any, values: any): any {
      var target = jQuery(container).find('select.suggest-genes');
      if (target && target[0] && (target[0] as any).selectize) {
        if (Array.isArray(values)) {
          // Genes are just a straight array of strings
          (target[0] as any).selectize.clearOptions(true);
          var currentGenes = editor.getGeneLegend().getCurrentTerms();
          for (var gene of currentGenes){
            console.log("Adding options " + gene.getID() + "=>" + gene.getName());
            (target[0] as any).selectize.addOption({'text': gene.getName(), 'value': gene.getID()});
          }
          (target[0] as any).selectize.setValue(values, true);
          (target[0] as any).selectize.refreshOptions(false);
          applySelectizeSwatches(container, editor.getGeneLegend());
        }
      }
    },
    'select' : function(container: any, value: any): any {
      var target = container.querySelector('select option[value="' + value + '"]');
      if (target) {
        target.selected = 'selected';
      }
    },
    'hidden' : function(container: any, value: any): any {
      var target = container.querySelector('input[type=hidden]');
      if (target) {
        target.value = value;
      }
    },
    'number' : function(container: any, value: any): any {
      var target = container.querySelector('input[type=number]');
      if (target) {
        target.value = (value === null || value === undefined) ? '' : value;
      }
    },
    'heading' : function(_container: any, _value: any): any {
      // no interactive value
    },
    'questionnaire-choice-picker' : function(container: any, value: any): any {
      var target = jQuery(container).find('select.suggest-questionnaire');
      if (target && target[0] && (target[0] as any).selectize) {
        var selectizeInstance = (target[0] as any).selectize;
        var answers = Array.isArray(value) ? value : (value ? [value] : []);
        selectizeInstance.clearOptions(true);
        answers.forEach(function(answer: any) {
          if (answer && answer.code) {
            selectizeInstance.addOption({ text: answer.display || answer.code, value: answer.code, system: answer.system });
          }
        });
        selectizeInstance.setValue(answers.map(function(a: any) { return a.code; }), true);
        selectizeInstance.refreshOptions(false);
      }
    },
    'button-action': function(_container: any, _value: any) {},
    'questionnaire-legend-picker' : function(container: any, values: any): any {
      var target = jQuery(container).find('select.suggest-questionnaire-legend');
      if (target && target[0] && (target[0] as any).selectize) {
        var linkId = (target[0] as any).dataset.linkid;
        var legend = editor.getQuestionnaireLegend && editor.getQuestionnaireLegend(linkId);
        if (Array.isArray(values) && legend) {
          var ids: any[] = [];
          values.forEach(function(v: any) {
            if (v && v.code) {
              ids.push(v.code);
            }
          });
          (target[0] as any).selectize.clearOptions(true);
          var currentTerms = legend.getCurrentTerms();
          for (var term of currentTerms) {
            (target[0] as any).selectize.addOption({'text': term.getName(), 'value': term.getID()});
          }
          (target[0] as any).selectize.setValue(ids, true);
          (target[0] as any).selectize.refreshOptions(false);
          applySelectizeSwatches(container, legend);
        }
      }
    }
  };

  _toggleFieldVisibility(container: any, doHide: any): any {
    if (doHide) {
      container.classList.add('hidden');
    } else {
      container.classList.remove('hidden');
    }
  }

  _setFieldInactive: any = {
    'radio' : function(this: any, container: any, inactive: any): any {
      if (inactive === true) {
        container.classList.add('hidden');
      } else {
        container.classList.remove('hidden');
        Array.from(container.querySelectorAll('input[type=radio]')).forEach(function(item: any) {
          if (inactive && Object.prototype.toString.call(inactive) === '[object Array]') {
            item.disabled = (inactive.indexOf(item.value) >= 0);
            if (item.disabled) {
              item.parentElement.classList.add('hidden');
            } else {
              item.parentElement.classList.remove('hidden');
            }
          } else if (!inactive) {
            item.disabled = false;
            item.parentElement.classList.remove('hidden');
          }
        });
      }
    },
    'checkbox' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'text' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'textarea' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'date-picker' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'disease-picker' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'hpo-picker' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'gene-picker' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'select' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'hidden' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'number' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'heading' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'questionnaire-choice-picker' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    },
    'button-action': function(this: any, container: any, inactive: any) { this._toggleFieldVisibility(container, inactive); },
    'questionnaire-legend-picker' : function(this: any, container: any, inactive: any): any {
      this._toggleFieldVisibility(container, inactive);
    }
  };

  _setFieldDisabled: any = {
    'radio' : function(container: any, disabled: any): any {
      if (disabled === true) {
        container.classList.add('hidden');
      } else {
        container.classList.remove('hidden');
        Array.from(container.querySelectorAll('input[type=radio]')).forEach(function(item: any) {
          if (disabled && Object.prototype.toString.call(disabled) === '[object Array]') {
            item.disabled = (disabled.indexOf(item.value) >= 0);
          }
          if (!disabled) {
            item.disabled = false;
          }
        });
      }
    },
    'checkbox' : function(container: any, disabled: any): any {
      var target = container.querySelector('input[type=checkbox]');
      if (target) {
        target.disabled = disabled;
      }
    },
    'text' : function(container: any, disabled: any): any {
      var target = container.querySelector('input[type=text]');
      if (target) {
        target.disabled = disabled;
      }
    },
    'textarea' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    },
    'date-picker' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    },
    'disease-picker' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    },
    'hpo-picker' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    },
    'gene-picker' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    },
    'select' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    },
    'hidden' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    },
    'number' : function(container: any, disabled: any): any {
      var target = container.querySelector('input[type=number]');
      if (target) {
        target.disabled = disabled;
      }
    },
    'heading' : function(container: any, inactive: any): any {
      // no interactive value
    },
    'questionnaire-choice-picker' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    },
    'button-action': function(container: any, disabled: any) {
      var btn = container.querySelector('button');
      if (btn) btn.disabled = disabled;
    },
    'questionnaire-legend-picker' : function(container: any, inactive: any): any {
      // FIXME: Not implemented
    }
  };
}
