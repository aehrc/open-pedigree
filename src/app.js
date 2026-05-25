import PedigreeEditor from './script/pedigree';

import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';

import 'flatpickr/dist/flatpickr.min.css';
import '@selectize/selectize/dist/css/selectize.default.css';
import '@selectize/selectize';
import LocalStorageBackend from "./script/localStorageBackend";


const OpenPedigree = OpenPedigree || {};

OpenPedigree.initialiseEditor = function(options){
  return new PedigreeEditor(options);
};

OpenPedigree.localStorageBackend = LocalStorageBackend

window.OpenPedigree = OpenPedigree;
