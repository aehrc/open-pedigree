/**
 * Minimal native modal dialog replacing PhenoTips.widgets.ModalPopup.
 * API surface: constructor(content, closeConfig, displayOptions), show(), close(), closeDialog()
 */
export class NativeModal {
    private overlay: HTMLElement;
    private closeMethod: () => void;

    constructor(content: HTMLElement, closeConfig: any, options: any) {
        this.closeMethod = closeConfig?.close?.method || (() => {});

        this.overlay = document.createElement('div');
        this.overlay.className = 'msdialog-modal-container';
        this.overlay.style.display = 'none';

        var box = document.createElement('div');
        box.className = 'msdialog-box ' + (options?.extraClassName || '');

        if (options?.title) {
            var titleEl = document.createElement('div');
            titleEl.className = 'msdialog-title';
            titleEl.textContent = options.title;
            box.appendChild(titleEl);
        }

        if (options?.displayCloseButton !== false) {
            var closeBtn = document.createElement('button');
            closeBtn.className = 'msdialog-close-btn';
            closeBtn.textContent = '×';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.addEventListener('click', () => this.closeDialog());
            box.appendChild(closeBtn);
        }

        var contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.appendChild(content);
        box.appendChild(contentDiv);

        if (options?.verticalPosition === 'top') {
            box.classList.add('msdialog-top');
        }

        this.overlay.appendChild(box);
        document.body.appendChild(this.overlay);

        var keys: string[] = closeConfig?.close?.keys || [];
        if (keys.includes('Esc')) {
            document.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Escape' && this.overlay.style.display !== 'none') {
                    this.closeDialog();
                }
            });
        }

        this.overlay.addEventListener('click', (e: MouseEvent) => {
            if (e.target === this.overlay) {
                this.closeDialog();
            }
        });
    }

    show(): void {
        this.overlay.style.display = '';
    }

    close(): void {
        this.overlay.style.display = 'none';
        this.closeMethod();
    }

    closeDialog(): void {
        this.overlay.style.display = 'none';
    }
}
