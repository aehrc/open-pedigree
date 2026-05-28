## Context

Open Pedigree nodes are currently anonymous — there is no way to associate a node with a known FHIR Patient resource. The REDCap EM and the planned SMART on FHIR integration both need this capability, but the mechanism differs (REDCap has its own patient search; SMART uses FHIR Patient search). The `AbstractPatientProvider` interface creates a single seam that both can plug into without touching the editor internals.

The editor already bundles jQuery (since the PrototypeJS removal), which handles AJAX. No new dependencies are needed for the FHIR search.

The GA4GH FHIR spec already includes the `linkedPatientRef` requirement (added during the backport sync). The implementation work here fulfils that spec.

## Goals / Non-Goals

**Goals:**
- Define a stable `AbstractPatientProvider` interface that both REDCap and SMART on FHIR can implement
- Ship a working `FHIRPatientProvider` that covers the common SMART on FHIR case (FHIR R4 Patient search + Condition import)
- Add `linkedPatientRef` as a first-class node property, serialised in internal JSON and used in GA4GH export
- Keep the editor fully functional when no provider is configured (EmptyPatientProvider default)

**Non-Goals:**
- SMART on FHIR authentication / OAuth — that is Change 2 (`smart-on-fhir`)
- Importing phenotypes or genes from clinical records — initial scope is Condition → disorders only
- REDCap-specific patient search UI — REDCap EM will implement its own `AbstractPatientProvider` subclass
- Editing or writing back to the FHIR server from within this change

## Decisions

### D1: Provider owns its modal UI

The host page supplies a `patientProvider` instance to `initialiseEditor()`. When the editor needs to open a patient picker it calls `provider.openPatientPickerModal(nodeId, onSelected)` and hands control to the provider. The provider is responsible for rendering, searching, and calling `onSelected(fhirRef, displayName)` when done.

**Rationale:** Different backends have fundamentally different search UIs (REDCap has its own patient search widget; SMART has a FHIR Patient search; some deployments may not want a picker at all). Putting modal rendering in the provider keeps the editor UI-agnostic.

**Alternative considered:** Editor owns a generic search dialog that providers fill with data. Rejected — requires the editor to maintain a configurable modal, and REDCap cannot use it.

### D2: FHIRPatientProvider uses inline jQuery AJAX

`FHIRPatientProvider` uses `$.ajax()` for patient search and condition fetch. This is consistent with the rest of the codebase (DelegatingTerminology, SaveLoadEngine) and avoids adding `fetch` polyfill concerns.

**Alternative considered:** Native `fetch()`. Viable but inconsistent with rest of codebase; deferred.

### D3: lookupPatient called on pedigree load for linked nodes

When a pedigree containing `linkedPatientRef` nodes is loaded, `SaveLoadEngine` calls `provider.lookupPatient(fhirRef, onSuccess, onError)` for each linked node to resolve the display name. This keeps the node name fresh without requiring it to be serialised.

**Rationale:** Patient names can change (legal name updates, preferred name). Resolving on load avoids stale names in saved pedigrees.

**Alternative considered:** Serialise display name alongside `linkedPatientRef`. Simpler but creates stale-name risk.

### D4: Clinical import is additive only

`openClinicalImportModal` imports data (initially: Conditions → disorders) by *adding* to the node's existing properties. It never removes or overwrites existing values.

**Rationale:** The pedigree may contain family-reported information that differs from the clinical record. Silently overwriting destroys information. Merge/conflict UI is deferred to a future change.

### D5: FHIRPatientProvider fhirBaseUrl comes from options

`FHIRPatientProvider` is constructed with a `fhirBaseUrl` option. In the SMART on FHIR context (Change 2) this will be `client.getState('serverUrl')`. For standalone use it can be any FHIR R4 server.

### D6: EmptyPatientProvider is the default

If no `patientProvider` is passed to `initialiseEditor()`, the editor uses `EmptyPatientProvider` which does nothing. "Link to patient" button is still shown but disabled (or hidden) to avoid confusing users on deployments without a provider.

**Alternative considered:** Conditionally hiding the button based on provider presence. Both approaches are acceptable; hiding is cleaner UX.

## Risks / Trade-offs

- **FHIR server CORS** — `FHIRPatientProvider` makes cross-origin requests; the FHIR server must allow CORS from the host origin. In SMART on FHIR this is handled by the auth server; for standalone use it is the deployer's responsibility. → No mitigation needed in this change; document in README.

- **lookupPatient race on large pedigrees** — if many nodes have `linkedPatientRef`, multiple parallel FHIR calls fire on load. → Acceptable for initial implementation; batch or debounce can be added later.

- **Condition → disorder mapping fidelity** — not all Conditions map cleanly to OMIM/HPO disorder IDs. `FHIRPatientProvider` will use the Condition code system as the disorder ID (e.g. SNOMED CT code). The terminology backend must be configured to match for labels to resolve. → Documented constraint; no mitigation in this change.

## Open Questions

- Should the "Link to patient" button be hidden when `EmptyPatientProvider` is active, or shown but disabled? (UX decision — can decide during implementation)
- Should `lookupPatient` be called eagerly on load or lazily on node open? (Eager gives better UX but more FHIR calls; lazy is safer for large pedigrees with many linked nodes)
