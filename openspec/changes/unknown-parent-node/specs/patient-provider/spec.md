## ADDED Requirements

### Requirement: GA4GH FHIR export encodes unknownParent as a FHIR extension
When exporting a pedigree to GA4GH FHIR format, PERSON nodes with `unknownParent: true` SHALL have a FHIR extension added to their Patient resource:
```
url: "https://github.com/aehrc/open-pedigree/unknownParent"
valueBoolean: true
```

#### Scenario: Unknown parent node is exported with extension
- **WHEN** a pedigree is exported to GA4GH FHIR and a PERSON node has `unknownParent: true`
- **THEN** the corresponding Patient resource SHALL contain the `unknownParent` extension with `valueBoolean: true`

#### Scenario: Normal node has no unknownParent extension
- **WHEN** a pedigree is exported to GA4GH FHIR and a PERSON node has `unknownParent` absent or `false`
- **THEN** the corresponding Patient resource SHALL NOT contain the `unknownParent` extension

---

### Requirement: GA4GH FHIR import restores unknownParent from the extension
When importing a GA4GH FHIR pedigree, if a Patient resource carries the `unknownParent` extension with `valueBoolean: true`, the corresponding PERSON node SHALL have `unknownParent: true` set on its properties.

#### Scenario: Import round-trips unknownParent
- **WHEN** a FHIR Bundle is imported that contains a Patient with the `unknownParent` extension
- **THEN** the corresponding node SHALL have `unknownParent: true` after import

#### Scenario: Import without extension leaves unknownParent unset
- **WHEN** a FHIR Bundle is imported and a Patient has no `unknownParent` extension
- **THEN** the corresponding node SHALL have `unknownParent` absent or `false`
