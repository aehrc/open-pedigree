import PedigreeEditor from './script/pedigree';

import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'

import 'flatpickr/dist/flatpickr.min.css';
import '@selectize/selectize/dist/css/selectize.default.css';
import '@selectize/selectize';
import TerminologyManager from "pedigree/terminology/terminologyManger";
import FHIRTerminology from "pedigree/terminology/FHIRTerminology";

var editor;

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
