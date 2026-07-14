import smartFHIR from 'fhirclient';
import PedigreeEditor from './script/pedigree';
import SmartFhirBackend from './script/SmartFhirBackend';
import SmartPatientProvider from './script/patientProvider/SmartPatientProvider';
import LocalStorageBackend from './script/localStorageBackend';
import FHIRPatientProvider from './script/patientProvider/FHIRPatientProvider';
import { DEFAULT_QUESTIONNAIRE } from './script/questionnaire/defaultQuestionnaire';

import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';

import 'flatpickr/dist/flatpickr.min.css';
import '@selectize/selectize/dist/css/selectize.default.css';
import '@selectize/selectize';

const OpenPedigree: any = {};

OpenPedigree.initialiseEditor = function(options: any) {
    return new PedigreeEditor(options);
};

OpenPedigree.localStorageBackend = LocalStorageBackend;
OpenPedigree.FHIRPatientProvider = FHIRPatientProvider;
OpenPedigree.SmartFhirBackend = SmartFhirBackend;
OpenPedigree.SmartPatientProvider = SmartPatientProvider;
OpenPedigree.defaultQuestionnaire = DEFAULT_QUESTIONNAIRE;

// Expose on window so tests can override via addInitScript before DOMContentLoaded
if (!(window as any).FHIR) {
    (window as any).FHIR = smartFHIR;
}

(window as any).OpenPedigree = OpenPedigree;

document.addEventListener('DOMContentLoaded', () => {
    const FHIR = (window as any).FHIR;
    FHIR.oauth2.ready()
        .then((client: any) => {
            const backend = new SmartFhirBackend(client);
            const provider = new SmartPatientProvider(client);

            const ONTOSERVER_BASE = 'https://tx.ontoserver.csiro.au/fhir';
            const SNOMED_SYSTEM   = 'http://snomed.info/sct';
            const HGNC_SYSTEM     = 'http://purl.bioontology.org/ontology/HGNC/hgnc.owl';

            // Well-known Questionnaire seeded onto the same FHIR server this app launched
            // against (see tests/fixtures/smart/questionnaire.json / docker-compose.smart.yml).
            // A real deployment would point this at its own Questionnaire instead.
            const fhirBaseUrl = (client.getState('serverUrl') || '').replace(/\/$/, '');
            const DEMO_QUESTIONNAIRE_ID = 'demo-questionnaire';

            const editor = OpenPedigree.initialiseEditor({
                patientDataUrl: 'smart:pedigree',
                backend: {
                    save: backend.save.bind(backend),
                    load: backend.load.bind(backend),
                },
                patientProvider: provider,
                questionnaireUrl: fhirBaseUrl + '/Questionnaire/' + DEMO_QUESTIONNAIRE_ID,
                disorderOptions: {
                    type:         'FHIR',
                    codeSystem:   SNOMED_SYSTEM,
                    fhirBaseUrl:  ONTOSERVER_BASE,
                    valueSet:     'http://snomed.info/sct?fhir_vs=refset/32570581000036105',
                    validIdRegex: /^\d+$/,
                },
                phenotypeOptions: {
                    type:         'FHIR',
                    codeSystem:   SNOMED_SYSTEM,
                    fhirBaseUrl:  ONTOSERVER_BASE,
                    valueSet:     'http://ga4gh.org/fhir/ValueSet/phenotype',
                    validIdRegex: /^\d+$/,
                },
                geneOptions: {
                    type:        'FHIR',
                    codeSystem:  HGNC_SYSTEM,
                    fhirBaseUrl: ONTOSERVER_BASE,
                    valueSet:    'http://www.genenames.org',
                },
                fhirTerminologyHelperOptions: {
                    disorderCodeSystem:  SNOMED_SYSTEM,
                    phenotypeCodeSystem: SNOMED_SYSTEM,
                    geneCodeSystem:      HGNC_SYSTEM,
                },
            });

            // Wait for the async pedigree load to finish before linking the proband,
            // so the graph and view are fully rebuilt when we dispatch the property event.
            document.addEventListener('pedigree:load:finish', () => {
                provider.prepopulateProband(0);
            }, { once: true });
        })
        .catch((err: any) => {
            console.error('[smartEditor] FHIR.oauth2.ready() failed:', err);
            const errDiv = document.createElement('div');
            errDiv.id = 'smart-auth-error';
            errDiv.style.cssText = 'font-family:sans-serif;padding:32px;color:#b00020;font-size:16px;';
            errDiv.innerHTML = '<strong>Authentication failed.</strong> '
                + 'Please re-launch this application from your EHR.<br><small>'
                + String(err) + '</small>';
            document.body.appendChild(errDiv);
        });
});
