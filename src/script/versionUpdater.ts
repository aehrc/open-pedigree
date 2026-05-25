export default class VersionUpdater {
  availableUpdates: any[];

  constructor() {
    this.availableUpdates = [
      {
        comment: 'group node comment representation',
        introduced: 'May2014',
        func: 'updateGroupNodeComments',
      },
    ];
  }

  updateToCurrentVersion(pedigreeJSON: any): any {
    for (let i = 0; i < this.availableUpdates.length; i++) {
      const update = this.availableUpdates[i];
      const updateResult = (this as any)[update.func](pedigreeJSON);
      if (updateResult !== null) {
        console.log('[update #' + i + '] [updating to ' + update.introduced + ' version] - performing ' + update.comment + ' update');
        pedigreeJSON = updateResult;
      }
    }
    return pedigreeJSON;
  }

  updateGroupNodeComments(pedigreeJSON: any): any {
    let change = false;
    const data = JSON.parse(pedigreeJSON);
    for (let i = 0; i < data.GG.length; i++) {
      const node = data.GG[i];
      if (node.hasOwnProperty('prop')) {
        if (
          node.prop.hasOwnProperty('numPersons') &&
          !node.prop.hasOwnProperty('comments') &&
          node.prop.hasOwnProperty('fName') &&
          node.prop.hasOwnProperty('fName') != ''
        ) {
          node.prop['comments'] = node.prop.fName;
          delete node.prop.fName;
          change = true;
        }
      }
    }
    if (!change) {
      return null;
    }
    return JSON.stringify(data);
  }
}
