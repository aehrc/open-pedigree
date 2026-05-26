# native-dom-events Specification

## Purpose
TBD - created by archiving change remove-prototype. Update Purpose after archive.
## Requirements
### Requirement: Prototype DOM construction replaced with native APIs
All `new Element(tag, attributes)` calls SHALL be replaced with `document.createElement(tag)` followed by `setAttribute` / `classList.add` / `textContent` as appropriate. No call to `new Element` SHALL remain in `src/script/`.

#### Scenario: Element created with class attribute
- **WHEN** source code previously called `new Element('div', {'class': 'foo'})`
- **THEN** the replacement calls `document.createElement('div')` and `el.className = 'foo'` (or `el.classList.add('foo')`)

#### Scenario: No remaining Prototype element construction
- **WHEN** `grep -r "new (Element" src/script/` is run after migration
- **THEN** it produces no output

### Requirement: Prototype DOM manipulation replaced with native APIs
All Prototype element methods SHALL be replaced with their native equivalents:
- `.insert({top: x})` / `.insert({bottom: x})` → `prepend(x)` / `append(x)`
- `.insert(x)` (default bottom) → `append(x)`
- `.update(html)` → `innerHTML = html` or `textContent = text`
- `.select(selector)` → `querySelectorAll(selector)`
- `.up(selector)` → `closest(selector)`
- `.down(selector)` → `querySelector(selector)`
- `.addClassName(c)` → `classList.add(c)`
- `.removeClassName(c)` → `classList.remove(c)`
- `.hasClassName(c)` → `classList.contains(c)`
- `.setStyle({prop: val})` → `style.prop = val`
- `.getStyle(prop)` → `getComputedStyle(el).getPropertyValue(prop)`
- `.show()` / `.hide()` → `style.display = ''` / `style.display = 'none'`

#### Scenario: No remaining Prototype DOM methods
- **WHEN** `grep -rn "\.addClassName\|\.removeClassName\|\.hasClassName\|\.setStyle\|\.getStyle\|\.insert\b\|\.update\b" src/script/` is run
- **THEN** it produces no output

### Requirement: Prototype event system replaced with native CustomEvent
All `document.observe(eventName, handler)` calls SHALL be replaced with `document.addEventListener(eventName, handler)`. All `document.fire(eventName, memo)` calls SHALL be replaced with `document.dispatchEvent(new CustomEvent(eventName, { detail: memo }))`. All handlers that read `event.memo` SHALL read `event.detail` instead.

#### Scenario: Custom event fired and received
- **WHEN** source code fires `pedigree:node:setproperty` with a memo object
- **THEN** `document.dispatchEvent(new CustomEvent('pedigree:node:setproperty', { detail: memo }))` is called, and the corresponding listener receives `event.detail` with the memo data

#### Scenario: No remaining Prototype event methods
- **WHEN** `grep -rn "document\.observe\|document\.fire\|document\.stopObserving\|\.observe(\|\.stopObserving(\|event\.memo" src/script/` is run
- **THEN** it produces no output

### Requirement: Ajax.Request replaced with fetch()
All `new Ajax.Request(url, options)` calls SHALL be replaced with `fetch(url, fetchOptions)`. The `onSuccess` callback SHALL be called with the response after `response.ok` is true. The `onFailure` callback SHALL be called when `response.ok` is false or on network error. The `onComplete` callback SHALL be called via `.finally()`.

#### Scenario: Successful AJAX response
- **WHEN** the server returns HTTP 200
- **THEN** the `onSuccess`-equivalent callback is invoked with a response object whose text is accessible via `await response.text()`

#### Scenario: No remaining Ajax.Request
- **WHEN** `grep -rn "Ajax\.Request\|Ajax\.Responders" src/script/` is run
- **THEN** it produces no output

### Requirement: bindAsEventListener replaced with bind
All `.bindAsEventListener(context)` calls SHALL be replaced with `.bind(context)`. Native `addEventListener` does not require the Prototype-specific binding wrapper.

#### Scenario: No remaining bindAsEventListener
- **WHEN** `grep -rn "bindAsEventListener" src/script/` is run
- **THEN** it produces no output

### Requirement: Prototype Array extensions replaced with native equivalents
All Prototype Array extension methods SHALL be replaced:
- `array.each(fn)` → `array.forEach(fn)`
- `array.invoke(method)` → `array.map(el => el[method]())`
- `array.detect(fn)` → `array.find(fn)`
- `array.select(fn)` → `array.filter(fn)`
- `$A(nodeList)` → `Array.from(nodeList)`

#### Scenario: No remaining Prototype Array methods
- **WHEN** `grep -rn "\.invoke(\|\.detect(\|\.each(\|\.select(" src/script/` is run after migration
- **THEN** it produces no output (native `.forEach`, `.find`, `.filter`, `.map` are acceptable)

### Requirement: Controller fires pedigree:person:set events
See the `person-set-events` capability spec. This requirement records the
addition to the event vocabulary managed by this module.

The full set of events dispatched by the controller SHALL include the
`pedigree:person:set:<field>` family in addition to all previously specified events.

#### Scenario: Set event is part of controller event contract
- **WHEN** `pedigree:node:setproperty` is handled by the controller for a person node
- **THEN** both the existing property mutation AND a new `pedigree:person:set:<field>` event occur
- **AND** the order is: mutation first, then event dispatch

