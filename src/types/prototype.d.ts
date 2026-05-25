// Global declarations for the Open Pedigree editor.

declare var editor: any;
declare var jQuery: any;

// CSS module side-effect import support
declare module '*.css' {
  const css: any;
  export default css;
}
