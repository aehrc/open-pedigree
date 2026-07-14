import PedigreeEditor from './script/pedigree';

import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';

import 'flatpickr/dist/flatpickr.min.css';
import '@selectize/selectize/dist/css/selectize.default.css';
import '@selectize/selectize';
import LocalStorageBackend from "./script/localStorageBackend";
import FHIRPatientProvider from './script/patientProvider/FHIRPatientProvider';
import { DEFAULT_QUESTIONNAIRE } from './script/questionnaire/defaultQuestionnaire';


const OpenPedigree: any = {};

OpenPedigree.initialiseEditor = function(options){
  return new PedigreeEditor(options);
};

OpenPedigree.localStorageBackend = LocalStorageBackend;
OpenPedigree.FHIRPatientProvider = FHIRPatientProvider;
OpenPedigree.defaultQuestionnaire = DEFAULT_QUESTIONNAIRE;

window.OpenPedigree = OpenPedigree;
