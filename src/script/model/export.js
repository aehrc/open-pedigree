import PDFDocument from 'vendor/pdfkit/pdfkit.standalone';
import SVGtoPDF from 'vendor/pdfkit/svg-to-pdfkit';
import blobStream from 'vendor/pdfkit/blob-stream';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';

var PedigreeExport = function () {
};

PedigreeExport.prototype = {
};

//===============================================================================================

/*
 *  PED format:
 *  (from http://pngu.mgh.harvard.edu/~purcell/plink/data.shtml#ped)
 *   Family ID
 *   Individual ID
 *   Paternal ID
 *   Maternal ID
 *   Sex (1=male; 2=female; other=unknown)
 *   Phenotype
 *
 *   Phenotype, by default, should be coded as:
 *      -9 missing
 *       0 missing
 *       1 unaffected
 *       2 affected
 */
PedigreeExport.exportAsPED = function(pedigree, idGenerationPreference) {
  var output = '';

  var familyID = 'OPENPED';

  var idToPedId = PedigreeExport.createNewIDs(pedigree, idGenerationPreference);

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }

    output += familyID + ' ' + idToPedId[i] + ' ';

    // mother & father
    var parents = pedigree.GG.getParents(i);
    if (parents.length > 0) {
      var father = parents[0];
      var mother = parents[1];

      if ( pedigree.GG.properties[parents[0]]['gender'] == 'F' ||
                pedigree.GG.properties[parents[1]]['gender'] == 'M' ) {
        father = parents[1];
        mother = parents[0];
      }
      output += idToPedId[father] + ' ' + idToPedId[mother] + ' ';
    } else {
      output += '0 0 ';
    }

    var sex = 3;
    if (pedigree.GG.properties[i]['gender'] == 'M') {
      sex = 1;
    } else if (pedigree.GG.properties[i]['gender'] == 'F') {
      sex = 2;
    }
    output += (sex + ' ');

    var status = -9; //missing
    if (pedigree.GG.properties[i].hasOwnProperty('carrierStatus')) {
      if (pedigree.GG.properties[i]['carrierStatus'] == 'affected' ||
               pedigree.GG.properties[i]['carrierStatus'] == 'carrier'  ||
               pedigree.GG.properties[i]['carrierStatus'] == 'presymptomatic') {
        status = 2;
      } else {
        status = 1;
      }
    }
    output += status + '\n';
  }

  return output;
};

PedigreeExport.exportAsPEDX = function(pedigree, idGenerationPreference, pedigreeImagesString) {
  const pedString = PedigreeExport.exportAsPED(pedigree, idGenerationPreference);

  let out = '<openpedigree>\n<ped>\n' + pedString + '</ped>\n';
  if (pedigreeImagesString){
    out = out + '<image>\n' + pedigreeImagesString + '</image>\n';
  }
  out = out + '</openpedigree>';
  return out;
}

/**
 * Export as DADA2 format.
 *
 * The DADA2 questionnaire collects 2 pieces of information about members:
 *   - life status
 *      - Alive
 *      - Deceased
 *      - Unborn
 *      - Stillborn
 *      - Miscarriage
 *      - Aborted
 *      - Adopted
 *   - Affected
 *      - Has DADA2 Symptoms
 *      - Has 1 Gene Change in ADA2
 *      - Has 2 Gene Changes in ADA2
 *      - Has Low ADA2 level
 *      - Has No ADA2 (zero)
 *      - Not Tested
 *      - Don't Know
 *  The format is based on PED, but there is a field for life status and adopted, and the phenotype
 *  mapping includes 0=missing; 1= unaffected; 2=affected; 3=Carrier; 4=Pre-symptomatic;-9=missing
 *
 *  First entry is the proband.
 *
 *  (0) Family ID
 *  (1) Individual ID
 *  (2) Paternal ID
 *  (3) Maternal ID
 *  (4) Sex (1=male; 2=female; other=unknown)
 *  (5) Affected (1= unaffected; 2=affected; 3=Carrier; 4=Pre-symptomatic;other=unaffected)
 *  (6) Life Status (1=Alive; 2=Deceased; 3=Unborn; 4=Stillborn; 5=Miscarriage; 6=Aborted; other/blank=Alive)
 *  (7) Adopted Outs (0=Not Adopted; 1=Adopted Out; other/blank=Not Adopted)
 *
 *  * @param inputText
 */

PedigreeExport.exportAsDADA2 = function(pedigree) {
  const idGenerationPreference = 'newid';
  var output = '';

  var familyID = 'DADA2';

  var idToPedId = PedigreeExport.createNewIDs(pedigree, idGenerationPreference);

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }

    output += familyID + ' ' + idToPedId[i] + ' ';

    // mother & father
    var parents = pedigree.GG.getParents(i);
    if (parents.length > 0) {
      var father = parents[0];
      var mother = parents[1];

      if ( pedigree.GG.properties[parents[0]]['gender'] == 'F' ||
          pedigree.GG.properties[parents[1]]['gender'] == 'M' ) {
        father = parents[1];
        mother = parents[0];
      }
      output += idToPedId[father] + ' ' + idToPedId[mother] + ' ';
    } else {
      output += '0 0 ';
    }

    var sex = 3;
    if (pedigree.GG.properties[i]['gender'] == 'M') {
      sex = 1;
    } else if (pedigree.GG.properties[i]['gender'] == 'F') {
      sex = 2;
    }
    output += (sex + ' ');

    var status = -9; //missing
    if (pedigree.GG.properties[i].hasOwnProperty('carrierStatus')) {
      //Affected (1= unaffected; 2=affected; 3=Carrier; 4=Pre-symptomatic;other=unaffected)
      if (pedigree.GG.properties[i]['carrierStatus'] == 'affected') {
        status = 2;
      } else if ( pedigree.GG.properties[i]['carrierStatus'] == 'carrier'){
        status = 3;
      } else if (pedigree.GG.properties[i]['carrierStatus'] == 'presymptomatic') {
        status = 4;
      } else {
        status = 1;
      }
    }
    output += status;

    var lifeStatus = 1; //missing
    if (pedigree.GG.properties[i].hasOwnProperty('lifeStatus')) {
      // Life Status (1=Alive; 2=Deceased; 3=Unborn; 4=Stillborn; 5=Miscarriage; 6=Aborted; other/blank=Alive)
      if (pedigree.GG.properties[i]['lifeStatus'] == 'deceased') {
        lifeStatus = 2;
      } else if ( pedigree.GG.properties[i]['lifeStatus'] == 'unborn'){
        lifeStatus = 3;
      } else if (pedigree.GG.properties[i]['lifeStatus'] == 'stillborn') {
        lifeStatus = 4;
      } else if (pedigree.GG.properties[i]['lifeStatus'] == 'miscarriage') {
        lifeStatus = 5;
      } else {
        lifeStatus = 1;
      }
    }
    output += ' ' + lifeStatus;

    if (pedigree.GG.properties[i].hasOwnProperty('isAdopted') && pedigree.GG.properties[i]['isAdopted']) {
      output += ' 1';
    }
    output += '\n';

  }

  return output;
};

PedigreeExport.exportAsDADA2X = function(pedigree, pedigreeImagesString) {
  const dada2String = PedigreeExport.exportAsDADA2(pedigree);

  let out = '<openpedigree>\n<dada2>\n' + dada2String + '</dada2>\n';
  if (pedigreeImagesString){
    out = out + '<image>\n' + pedigreeImagesString + '</image>\n';
  }
  out = out + '</openpedigree>';
  return out;
}
/* ===============================================================================================
 *
 * Creates and returns a JSON in the "GA4GH FHIR JSON" format
 *
 * ===============================================================================================
 */

PedigreeExport.exportAsGA4GH = function(pedigree, privacySetting = "all", fhirPatientReference = null,
  pedigreeImage = null){
  return GA4GHFHIRConverter.exportAsFHIR(pedigree, privacySetting, fhirPatientReference, pedigreeImage);
};

// ===============================================================================================

PedigreeExport.exportAsSVG = function(pedigree, privacySetting = 'all') {
  var image = $('canvas');
  var background = image.getElementsByClassName('panning-background')[0];
  var backgroundPosition;
  var backgroundParent;
  if (background){
    backgroundPosition = background.nextSibling;
    backgroundParent = background.parentNode;
    backgroundParent.removeChild(background);
  }
  var bbox = image.down().getBBox();
  var pedigreeImage = image.innerHTML
    .replace(/xmlns:xlink=".*?"/, '')
    .replace(/width=".*?"/, '')
    .replace(/height=".*?"/, '')
    .replace(/viewBox=".*?"/, 'viewBox="' + bbox.x + ' ' + bbox.y + ' ' + bbox.width + ' ' + bbox.height + '" width="' + bbox.width + '" height="' + bbox.height + '" xmlns:xlink="http://www.w3.org/1999/xlink"');
  var context = window.location.href.replace(/&/g, '&amp;');
  pedigreeImage = pedigreeImage.split(context).join('');

  if (background){
    backgroundParent.insertBefore(background, backgroundPosition);
  }


  const parser = new DOMParser();
  const dom = parser.parseFromString(pedigreeImage, 'application/xml');

  function removeHiddenNodes(domNode) {
    let toRemove = [];
    for (let childNode of domNode.childNodes) {
      if (childNode.style && 'none' === childNode.style.display){
        toRemove.push(childNode);
      }
      else if (childNode.style && '0' == childNode.style.opacity && '0' == childNode.style.fillOpacity){
        toRemove.push(childNode);
      }
      else {
        removeHiddenNodes(childNode);
      }
    }
    for (let childNode of toRemove){
      domNode.removeChild(childNode);
    }
  }
  function removeText(dom, fontSize) {
    let toRemove = [];
    for (let textNode of dom.getElementsByTagName('text')){
      if (textNode.style.fontSize === fontSize){
        toRemove.push(textNode);
      }
    }
    for (let childNode of toRemove){
      childNode.parentNode.removeChild(childNode);
    }
  }

  removeHiddenNodes(dom.getRootNode());
  if (privacySetting !== 'all' ){
    removeText(dom, '20px');
  }
  if (privacySetting === 'minimal'){
    removeText(dom, '19px');
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(dom);
}



PedigreeExport.exportAsPDF = function(pedigree, privacySetting = 'all', pageSize = 'A4', layout = 'landscape', legendPos = 'TopRight'){
  var pedigreeImage = PedigreeExport.exportAsSVG(pedigree, privacySetting);

  let legend = [];
  let itemCount = 0;
  let container = document.getElementById('legend-container');
  let rgbRegex =/^rgb\(([0-9]+), ?([0-9]+), ?([0-9]+)\)$/;
  for (let c of container.childNodes){
    if (c.tagName !== 'DIV'){
      continue;
    }
    if (c.style && c.style.display === 'none'){
      continue;
    }

    let h2Array = c.getElementsByTagName('H2');
    let legendSection = {
      heading: '',
      items: []
    };
    legend.push(legendSection);
    let colour = null;
    let name = null;
    let cases = null;

    if (h2Array){
      legendSection.heading = h2Array[0].textContent;
    }
    for (let li of c.getElementsByTagName('li')){
      let colourArray = li.getElementsByClassName('disorder-color');
      if (colourArray){
        colour = colourArray[0].style.backgroundColor;
        if (colour.startsWith('#')){
          // already hex
        } else if (colour.startsWith('rgb(')){
          // rgb
          let colourSplit = rgbRegex.exec(colour);
          if (colourSplit != null){
            colour = '#' + parseInt(colourSplit[1]).toString(16) + parseInt(colourSplit[2]).toString(16) + parseInt(colourSplit[3]).toString(16);
          }
        }
      }
      let nameArray = li.getElementsByClassName('disorder-name');
      if (nameArray){
        name = nameArray[0].textContent;
      }
      let casesArray = li.getElementsByClassName('disorder-cases');
      if (casesArray){
        cases = casesArray[0].textContent;
      }

      legendSection.items.push({colour: colour, name: name, cases: cases});
      itemCount++;
    }
  }


  let compress = false;
  let doc = new PDFDocument({compress: compress, size: pageSize, layout: layout});

  let stream = doc.pipe(blobStream());
  stream.on('finish', function () {
    let blob = stream.toBlob('application/pdf');
    //   // new FileSaver(blob, 'open-pedigree.pdf');
    //   navigator.msSaveOrOpenBlob(blob, 'open-pedigree.pdf');
    saveAs(blob, 'open-pedigree.pdf');
    //   // if (navigator.msSaveOrOpenBlob) {
    //   //   navigator.msSaveOrOpenBlob(blob, 'open-pedigree.pdf');
    //   // } else {
    //   //   alert("Don't know how to save to pdf in ie9")
    //   //   console.log("Don't know how to save in ie9");
    //   // }
  });
  let headingCount = legend.length;

  // work out max width for text
  let maxWidth = 0;
  doc.save();
  for (let cat of legend){
    doc.fontSize(14);
    const hw = doc.widthOfString(cat.heading);
    if (hw > maxWidth){
      maxWidth = hw;
    }
    for (let item of cat.items) {
      doc.fontSize(10);
      const w = doc.widthOfString(item.name + ' (' + item.cases + ')');
      if (w > maxWidth) {
        maxWidth = w;
      }
    }
  }
  doc.restore();

  let lineOffset = 14;
  let catOffset = 2;
  let legendHeight = (lineOffset * (headingCount+itemCount)) + (headingCount*catOffset) + 10;
  let xOffset = 5;
  let yOffset = doc.page.height - legendHeight;
  let pedigreeXOffset = 5;
  let pedigreeYOffset = legendHeight;
  let pedigreeWidth = doc.page.width - 10;
  let pedigreeHeight = Math.max(doc.page.height - legendHeight, doc.page.height * 0.6);

  if (legendPos === 'TopLeft') {
    // easy one.
    xOffset = 5;
    yOffset = 5;
    pedigreeYOffset = legendHeight;
  } else if (legendPos === 'BottomLeft') {
    xOffset = 5;
    yOffset = doc.page.height - legendHeight;
    pedigreeYOffset = 5;
  } else if (legendPos === 'BottomRight') {
    xOffset = doc.page.width - (20 + maxWidth) ;
    yOffset = doc.page.height - legendHeight;
    pedigreeYOffset = 5;
  } else {
    // 'TopRight' default
    xOffset = doc.page.width - (20 + maxWidth) ;
    yOffset = 5;
    pedigreeYOffset = legendHeight;
  }


  for (let cat of legend){
    doc.save();
    doc.fontSize(14);
    doc.text(cat.heading, xOffset, yOffset, {lineBreak: false});
    yOffset += lineOffset;
    for (let item of cat.items){
      // console.log(item);
      doc.save();
      doc.rect(xOffset, yOffset, 8, 8).fill(item.colour, 1);
      doc.restore();
      doc.fontSize(10);
      doc.text(item.name + ' (' + item.cases + ')', xOffset + 10, yOffset, {lineBreak: false});
      yOffset += lineOffset;
    }
    yOffset += catOffset;
    doc.restore();
  }

  let options = {
    warningCallback: (str)=>console.error(str),
    useCSS: false,
    assumePt: false,
    preserveAspectRatio: 'xMidYMid meet',
    // use at least 60% of height for image, this may overwrite the legend.
    height: pedigreeHeight,
    width: pedigreeWidth
  };

  SVGtoPDF(doc, pedigreeImage, pedigreeXOffset, pedigreeYOffset, options);
  doc.end();
  // doc.write('open-pedigree.pdf');
  return doc;
};


// ===============================================================================================

// TODO: convert internal properties to match public names and rename this to "supportedProperties"
PedigreeExport.internalToJSONPropertyMapping = {
  'proband':       'proband',
  'fName':         'firstName',
  'lName':         'lastName',
  'comments':      'comments',
  'twinGroup':     'twinGroup',
  'monozygotic':   'monozygotic',
  'isAdopted':     'adoptedIn',
  'evaluated':     'evaluated',
  'dob':           'birthDate',
  'dod':           'deathDate',
  'gestationAge':  'gestationAge',
  'lifeStatus':    'lifeStatus',
  'disorders':     'disorders',
  'ethnicities':   'ethnicities',
  'carrierStatus': 'carrierStatus',
  'externalID':    'externalId',
  'gender':        'sex',
  'numPersons':    'numPersons',
  'hpoTerms':      'hpoTerms',
  'candidateGenes':'candidateGenes',
  'lostContact':   'lostContact'
};

/*
 * Converts property name from external JSON format to internal - also helps to
 * support aliases for some terms and weed out unsupported terms.
 */
PedigreeExport.convertProperty = function(internalPropertyName, value) {

  if (!PedigreeExport.internalToJSONPropertyMapping.hasOwnProperty(internalPropertyName)) {
    return null;
  }

  var externalPropertyName = PedigreeExport.internalToJSONPropertyMapping[internalPropertyName];

  if (externalPropertyName == 'sex') {
    if (value == 'M') {
      value = 'male';
    } else if (value == 'F') {
      value = 'female';
    } else {
      value = 'unknown';
    }
  }

  return {'propertyName': externalPropertyName, 'value': value };
};

PedigreeExport.createNewIDs = function(pedigree, idGenerationPreference, maxLength) {
  var idToNewId = {};
  var usedIDs   = {};

  var nextUnusedID = 1;

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }

    var id = nextUnusedID++;
    if (idGenerationPreference == 'external' && pedigree.GG.properties[i].hasOwnProperty('externalID')) {
      nextUnusedID--;
      id = pedigree.GG.properties[i]['externalID'].replace(/\s/g, '_');
    } else if (idGenerationPreference == 'name' && pedigree.GG.properties[i].hasOwnProperty('fName')) {
      nextUnusedID--;
      id = pedigree.GG.properties[i]['fName'].replace(/\s/g, '_');
    }
    if (maxLength && id.length > maxLength) {
      id = id.substring(0, maxLength);
    }
    while ( usedIDs.hasOwnProperty(id) ) {
      if (!maxLength || id.length < maxLength) {
        id = '_' + id;
      } else {
        id = nextUnusedID++;
      }
    }

    idToNewId[i] = id;
    usedIDs[id]  = true;
  }

  return idToNewId;
};

export default PedigreeExport;
