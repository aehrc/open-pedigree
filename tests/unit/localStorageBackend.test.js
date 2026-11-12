import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('pedigree/model/export', () => ({
    default: {
        exportAsSVG: vi.fn().mockReturnValue('<svg/>'),
        exportAsGA4GH: vi.fn().mockReturnValue('GA4GH-DATA'),
        exportAsPED: vi.fn().mockReturnValue('PED-DATA'),
        exportAsPEDX: vi.fn().mockReturnValue('PEDX-DATA'),
        exportAsDADA2X: vi.fn().mockReturnValue('DADA2X-DATA'),
    }
}));
vi.mock('pedigree/view/templateSelector', () => ({ default: vi.fn() }));

import LocalStorageBackend from 'pedigree/localStorageBackend';

// How the save reads its patientDataUrl's query string: `format` picks the export, and
// `closeOnSave` closes the window when it is "true" or present without a value.
describe('LocalStorageBackend.save options', () => {
    let close;

    beforeEach(() => {
        localStorage.clear();
        LocalStorageBackend._context = undefined;
        globalThis.editor = {
            getView: () => ({ withoutGenerationNumbering: (fn) => fn() }),
            getGraph: () => ({ DG: {} }),
            flagClosing: vi.fn(),
        };
        close = vi.spyOn(window, 'close').mockImplementation(() => {});
    });

    afterEach(() => {
        delete globalThis.editor;
        close.mockRestore();
    });

    function save(patientDataUrl) {
        LocalStorageBackend.save({ patientDataUrl, setSaveInProgress: vi.fn(), jsonData: 'INTERNAL-DATA' });
        return JSON.parse(localStorage.getItem('pedigreeData'));
    }

    it('exports in the format the URL names', () => {
        expect(save('local:pedigreeData?format=PED').value).toBe('PED-DATA');
        expect(save('local:pedigreeData?closeOnSave=false&format=GA4GH').value).toBe('GA4GH-DATA');
    });

    it('saves the internal format when there is no format, or an empty one', () => {
        expect(save('local:pedigreeData').value).toBe('INTERNAL-DATA');
        expect(save('local:pedigreeData?format=').value).toBe('INTERNAL-DATA');
    });

    it('reads a percent-encoded value', () => {
        expect(save('local:pedigreeData?format=%50ED').value).toBe('PED-DATA');
    });

    it('closes the window for closeOnSave=true or a bare closeOnSave, and only then', () => {
        save('local:pedigreeData?format=PED&closeOnSave=true');
        save('local:pedigreeData?closeOnSave&format=PED');
        expect(close).toHaveBeenCalledTimes(2);

        save('local:pedigreeData?format=PED&closeOnSave=false');
        save('local:pedigreeData?format=PED');
        expect(close).toHaveBeenCalledTimes(2);
    });

    it('does not treat a parameter whose name only ends in the one asked for as that one', () => {
        expect(save('local:pedigreeData?xformat=PED').value).toBe('INTERNAL-DATA');
        save('local:pedigreeData?notcloseOnSave=true');
        expect(close).not.toHaveBeenCalled();
    });
});

// load() reads `format` from the same query string to pick the importer.
describe('LocalStorageBackend.load format', () => {
    let engine;

    beforeEach(() => {
        localStorage.clear();
        LocalStorageBackend._context = undefined;
        engine = {
            createGraphFromImportData: vi.fn().mockReturnValue(true),
            createGraphFromSerializedData: vi.fn(),
        };
        globalThis.editor = { getVersionUpdater: () => ({ updateToCurrentVersion: (d) => d }) };
        localStorage.setItem('pedigreeData', JSON.stringify({ value: 'STORED', context: { field: 'f' } }));
    });

    afterEach(() => {
        delete globalThis.editor;
        LocalStorageBackend._context = undefined;
    });

    it('imports in the format the URL names, keeping the stored context for the save', () => {
        LocalStorageBackend.load.call(engine, { patientDataUrl: 'local:pedigreeData?format=PED&closeOnSave=true' });
        expect(engine.createGraphFromImportData).toHaveBeenCalledWith('STORED', 'PED', {}, false, true);
        expect(engine.createGraphFromSerializedData).not.toHaveBeenCalled();
        expect(LocalStorageBackend._context).toEqual({ field: 'f' });
    });

    it('reads the internal format when there is none', () => {
        LocalStorageBackend.load.call(engine, { patientDataUrl: 'local:pedigreeData' });
        expect(engine.createGraphFromSerializedData).toHaveBeenCalledWith('STORED');
        expect(engine.createGraphFromImportData).not.toHaveBeenCalled();
    });
});
