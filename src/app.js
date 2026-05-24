import PedigreeEditor from './script/pedigree';

import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'

import '../public/vendor/xwiki/xwiki-min.css';
import '../public/vendor/xwiki/fullScreen.css';
import '../public/vendor/xwiki/colibri.css';
import '../public/vendor/phenotips/Widgets.css';
import '../public/vendor/phenotips/DateTimePicker.css';
import '../public/vendor/phenotips/Skin.css';
import '@selectize/selectize/dist/css/selectize.default.css';
import '@selectize/selectize';
import TerminologyManager from "pedigree/terminology/terminologyManger";
import FHIRTerminology from "pedigree/terminology/FHIRTerminology";

var editor;

document.observe('dom:loaded',function() {

});

var OpenPedigree = OpenPedigree || {};

OpenPedigree.initialiseEditor = function(options){
  return new PedigreeEditor(options);
};

OpenPedigree.setFHIRTerminology = function(type, fhirBaseUrl, codeSystem, valueSet, validIdRegex, searchCount){
  TerminologyManager.addTerminology(type,
      new FHIRTerminology(type, codeSystem, validIdRegex, searchCount, fhirBaseUrl, valueSet));
};

OpenPedigree.setCTSSTerminology = function(type, ctssBaseUrl, codeSystem, validIdRegex, searchCount, valueColumn, textColumn){
  TerminologyManager.addTerminology(type,
      new CTSSTerminology(type, codeSystem, validIdRegex, searchCount, ctssBaseUrl, valueColumn, textColumn));
};

window.OpenPedigree = OpenPedigree;
