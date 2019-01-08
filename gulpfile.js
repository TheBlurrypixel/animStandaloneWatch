const gulp = require('gulp');
const path = require('path');
const url = require('url');
var fs = require('fs')
var jsdom = require('jsdom');
const { JSDOM } = jsdom;
var browserSync = require('browser-sync').create();

//var isWin = process.platform === "win32";
var directory = './';

function loadHTML(err, html_string, filepath, inStretchingRatio, inAspectLimit)
{
  if(!html_string) return false;

  var stretchRatioFloat = parseFloat(inStretchingRatio);
  var aspectLimitFloat = parseFloat(inAspectLimit);
  var excludeAspectCode = (aspectLimitFloat == 0);

  // var progressBar = new ProgressBar( {text: 'Processing file...', detail: 'Wait...'} );
  // progressBar.on('completed', () => progressBar.detail = 'Task completed. Exiting...').on('aborted', () => app.quit());

  var fileContent = html_string.replace(/^\uFEFF/, '');

  const dom = new JSDOM(fileContent);

  var scriptInputs = dom.window.document.getElementsByTagName('script');

  function processScriptTag(element, data)
  {
    var par = element.parentNode;
    var elmnt = dom.window.document.createElement("script");
    var textnode = dom.window.document.createTextNode('\n' + data + '\n');
    elmnt.appendChild(textnode);
    par.replaceChild(elmnt, element);
  }

  function processScriptSrc(elememt)
  {
    // save a handle to the "this" pointer
    var myElement = elememt;

    // this is an anonymous function
    return function (err, data)
    {
      var par = myElement.parentNode;
      var elmnt = dom.window.document.createElement("script");
      var textnode = dom.window.document.createTextNode('\n' + data + '\n');
      elmnt.appendChild(textnode);
      par.replaceChild(elmnt, myElement);
    }
  }

  function findEndingBrace(inString, startingIndex)
  {
    var leftCurlyBraceIndex = inString.indexOf('{', startingIndex);// index of the '{' to which you need to find the matching '}'
    var rightCurlyBracesTobeIgnored = 0;
    var rightCurlyBraceIndex = -1;

    for (var i = leftCurlyBraceIndex + 1, len = inString.length; i < len; i++)
    {
      if(inString[i] == '}')
      {
        if (rightCurlyBracesTobeIgnored == 0)
        {
          rightCurlyBraceIndex = i;
          break;
        }
        else
        {
          rightCurlyBracesTobeIgnored -= 1;
        }
      }
      else if(inString[i] == '{')
      {
        rightCurlyBracesTobeIgnored += 1;
      }
    }

    return rightCurlyBraceIndex;
  }

  // replace linked libraries with inline scripts
  for(var i = 0; i < scriptInputs.length; i++)
  {
    if(scriptInputs[i].hasAttribute("src"))
    {
      if(!scriptInputs[i].src.startsWith("http"))
      {
        processScriptTag(scriptInputs[i], fs.readFileSync(path.join(directory, scriptInputs[i].src), 'utf8'));
      }
    }
  }

  // find the main CC script and get its element
  var scriptIndex = 0;
  var indexOfLib = -1
  var elementIndex = -1
  while(scriptIndex < scriptInputs.length)
  {
    var libPropIndex = scriptInputs[scriptIndex].text.search("lib.properties =");
    if(libPropIndex > -1)
    {
      elementIndex = scriptIndex;
      indexOfLib = libPropIndex;
      break;
    }
    else
    {
      libPropIndex = scriptInputs[scriptIndex].text.search("lib.properties=")
      if(libPropIndex > -1)
      {
        elementIndex = scriptIndex;
        indexOfLib = libPropIndex;
        break;
      }
    }
    scriptIndex++;
  }

  // referenceNode being the element to insert after
  function insertAfter(newNode, referenceNode)
  {
  	referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  }

  // get the manifest
  var elementWithManifestID = dom.window.document.getElementById('manifest');
  if(!(elementWithManifestID && elementWithManifestID.nodeName == 'SCRIPT')) {
    if(elementIndex > -1) {
      var indexOfClosingBrace = findEndingBrace(scriptInputs[elementIndex].text, indexOfLib);

      var lib = {};
      eval(scriptInputs[elementIndex].text.substring(indexOfLib, indexOfClosingBrace+1));

      if(lib.properties.hasOwnProperty("manifest"))
      {
        var prePost = "";
        var insertPre = "\n";
        for(var i = 0; i < lib.properties.manifest.length; i++)
        {
          var variableName = "dataURI_" + i;

          var imageAsBase64 = fs.readFileSync(path.join(directory, lib.properties.manifest[i].src), 'base64');
          var imageAsData = "";

          // determine if png or jpg
          var indexOfPeriod = lib.properties.manifest[i].src.lastIndexOf('.');
          if(indexOfPeriod > -1)
          {
            var extensionString = lib.properties.manifest[i].src.substr(indexOfPeriod+1, lib.properties.manifest[i].src.length-indexOfPeriod-1);

            if(extensionString.localeCompare("png")==0)
              imageAsData = "data:image/png;base64," + imageAsBase64;
            else if((extensionString.localeCompare("jpg")==0) || (extensionString.localeCompare("jpeg")==0))
              imageAsData = "data:image/jpg;base64," + imageAsBase64;
          }

          var midFix = variableName + " = \"" + imageAsData + "\";\n";
          var postFix = "\t\t{src:" + variableName + ", id:\"" + lib.properties.manifest[i].id + ((i == (lib.properties.manifest.length-1)) ? "\"}\n" : "\"},\n");

          insertPre = insertPre + midFix;
          prePost = prePost + postFix;
        }

        var insertPost = "var manifestImages = [\n" + prePost + "];\n";

        var par = scriptInputs[elementIndex].parentNode;
        var elmnt = dom.window.document.createElement("script");
        elmnt.setAttribute("id", "manifest");

        // var textnode = dom.window.document.createTextNode(insertPre + insertPost + scriptInputs[elementIndex].text + '\n');
        var textnode = dom.window.document.createTextNode(insertPre + insertPost + '\n');
        elmnt.appendChild(textnode);
        par.insertBefore(elmnt, scriptInputs[elementIndex]);
        // par.replaceChild(elmnt, scriptInputs[elementIndex]);
  //				console.log(dom.window.document.getElementsByTagName('html')[0].outerHTML);
      }
    }
  }

  scriptIndex = 0;
  var initScriptsElemIndex = -1;
  while(scriptIndex < scriptInputs.length)
  {
    if(scriptInputs[scriptIndex].text.search("function init()") > -1)
    {
      initScriptsElemIndex = scriptIndex;
      break;
    }
    scriptIndex++;
  }

  var insertLoaderCode = "\t// begin modified loader code\n \
\tvar queue = {};\n \
\thandleFileLoad(queue, comp);\n \
\thandleComplete(queue, comp)\n \
}\n \
function handleFileLoad(queue, comp) {\n \
\tvar images=comp.getImages();\n \
\tfor (var i = 0; i < manifestImages.length; i++)\n \
\t\tqueue[manifestImages[i].id] = images[manifestImages[i].id] = manifestImages[i].src;\n \
}\n \
function handleComplete(queue,comp) {\n \
\t//This function is always called, irrespective of the content. You can use the variable \"stage\" after it is created in token create_stage.\n \
\tvar lib=comp.getLibrary();\n \
\tvar ss=comp.getSpriteSheet();\n \
\tvar ssMetadata = lib.ssMetadata;\n \
\tfor(i=0; i<ssMetadata.length; i++) {\n \
\t\tss[ssMetadata[i].name] = new createjs.SpriteSheet( {\"images\": [queue[ssMetadata[i].name]], \"frames\": ssMetadata[i].frames} )\n \
\t}\n \
\t// end modified loader code\n";

var insertResponsiveCode = "\t// begin modified responsive code\n" +
(excludeAspectCode ? "\t\t\t\t}\n" : "\t\t\t\t\tvar ASPECTLIMIT = " + aspectLimitFloat.toString() + "; // Don't set below or equal to zero!!!!\n\t\t\t\t\tvar aspect = ih/iw;\n\t\t\t\t\tsRatio = aspect > ASPECTLIMIT ? ASPECTLIMIT*iw/h : ( aspect < (1/ASPECTLIMIT) ? ASPECTLIMIT*ih/w : sRatio);\n\t\t\t\t}\n") +
"\t\t\t}\n \
\t\t\tvar stretchingRatio = " + stretchRatioFloat.toString() + ";\n \
\t\t\tcanvas.width = iw*stretchingRatio;\n \
\t\t\tcanvas.height = ih*stretchingRatio;\n \
\t\t\tcanvas.style.width = dom_overlay_container.style.width = anim_container.style.width =  iw+'px';\n \
\t\t\tcanvas.style.height = anim_container.style.height = dom_overlay_container.style.height = ih+'px';\n \
\t\t\texportRoot.x = -(w*sRatio-iw) / (2 * sRatio);\n \
\t\t\texportRoot.y = -(h*sRatio-ih) / (2 * sRatio);\n \
\t\t\tstage.scaleX = sRatio*stretchingRatio;\n \
\t\t\tstage.scaleY = sRatio*stretchingRatio;\n \
\t// end modified responsive code\n";

  if(initScriptsElemIndex > -1)
  {
    var loaderIndex = scriptInputs[initScriptsElemIndex].text.search("var loader");
    if(loaderIndex > -1)
    {
      // find the index to insert
      var insertLoaderIndex = scriptInputs[initScriptsElemIndex].text.lastIndexOf("\n", loaderIndex) + 1;
      if(insertLoaderIndex > -1)
      {
        var exportRootIndex = scriptInputs[initScriptsElemIndex].text.indexOf("exportRoot", loaderIndex);
        if(exportRootIndex > -1)
        {
          var endLoaderIndex = scriptInputs[initScriptsElemIndex].text.lastIndexOf("\n", exportRootIndex) + 1;
          if(endLoaderIndex > -1)
          {
            var newText = scriptInputs[initScriptsElemIndex].text.substring(0, insertLoaderIndex) + insertLoaderCode + scriptInputs[initScriptsElemIndex].text.substr(endLoaderIndex, scriptInputs[initScriptsElemIndex].text.length-endLoaderIndex);

            var par = scriptInputs[initScriptsElemIndex].parentNode;
            var elmnt = dom.window.document.createElement("script");

            var textnode = dom.window.document.createTextNode(newText + '\n');
            elmnt.appendChild(textnode);
            par.replaceChild(elmnt, scriptInputs[initScriptsElemIndex]);
          }
        }
      }
    }

    var sRatioIndex = scriptInputs[initScriptsElemIndex].text.search("sRatio = Math.max");
    if(sRatioIndex > -1)
    {
      // find the index to insert
      var insertResponsiveIndex = scriptInputs[initScriptsElemIndex].text.indexOf("\n", sRatioIndex) + 1;
      if(insertResponsiveIndex > -1)
      {
        var lastWIndex = scriptInputs[initScriptsElemIndex].text.indexOf("lastW = iw", insertResponsiveIndex);
        if(lastWIndex > -1)
        {
          var endResponsiveIndex = scriptInputs[initScriptsElemIndex].text.lastIndexOf("\n", lastWIndex) + 1;
          if(endResponsiveIndex > -1)
          {
            var newText = scriptInputs[initScriptsElemIndex].text.substring(0, insertResponsiveIndex) + insertResponsiveCode + scriptInputs[initScriptsElemIndex].text.substr(endResponsiveIndex, scriptInputs[initScriptsElemIndex].text.length-endResponsiveIndex);

            var par = scriptInputs[initScriptsElemIndex].parentNode;
            var elmnt = dom.window.document.createElement("script");

            var textnode = dom.window.document.createTextNode(newText + '\n');
            elmnt.appendChild(textnode);
            par.replaceChild(elmnt, scriptInputs[initScriptsElemIndex]);
          }
        }
      }
    }
  }

  var outputHtml = "<!DOCTYPE html>\n" + dom.window.document.getElementsByTagName('html')[0].outerHTML;
  fs.writeFileSync(filepath, outputHtml);
//		fs.writeFileSync(filepath, dom.window.document.getElementsByTagName('html')[0].outerHTML);
  // progressBar.setCompleted();

//		Trying to close progressBar while it hasn't finished will call aborted and in this case quit the app so don't call it
//		progressBar.close();
  return true;
}

var baseDir = './build'
var inputFile = 'test.html';
var outputFile = baseDir + '/test.html';

// to run a specific task run gulp taskName
gulp.task('watch', (res) => {
  browserSync.init({
    server: {
        baseDir: baseDir,
        index: inputFile
    }
  });
  browserSync.watch("*.html").on("change", browserSync.reload);
  browserSync.watch("*.html").on("add", browserSync.reload);
  let watcher = gulp.watch(inputFile);
  if (!fs.existsSync(baseDir)){
      fs.mkdirSync(baseDir);
  }
  // console.log("checking exists");
  if (!fs.existsSync(outputFile)){
    // console.log("file doesnt exists");
    if(fs.existsSync('./'+inputFile))
      loadHTML(null, fs.readFileSync('./' + inputFile, 'utf8'), outputFile, 1, 2);
    else
      fs.writeFileSync(outputFile, "<html><body><h1>File note found</h1></body></html>");
  }
  console.log('Watching');
  watcher.on('add', (path) => {
    console.log(path + " was added");
    loadHTML(null, fs.readFileSync('./' + inputFile, 'utf8'), outputFile, 1, 2);
//    browserSync.reload();
  });
  watcher.on('change', (path) => {
    console.log(path + " was changed");
    loadHTML(null, fs.readFileSync('./' + inputFile, 'utf8'), outputFile, 1, 2);
//    browserSync.reload();
  });
});

gulp.task('default', () => {
  console.log('default running')
});
