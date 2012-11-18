
//Tributary display options
tributary.displays = [
  {name:"svg", description: "creates an <svg> element for you to use"},
  {name:"canvas", description: "creates a <canvas> element and gives you a Context for the canvas"},
  {name:"webgl", description: "gives you a Three.js WebGLRenderer scene"},
  {name:"div", description: "gives you a plain old <div>"},
];

//TODO: add icons
tributary.time_controls = [
  {name:"play", description: "gives you a play button, and tributary.t. if you provide tributary.run(g,t) it will be executed in a run loop"},
  {name:"loop", description: "gives you a loop where tributary.t goes from 0 to 1."},
  {name:"restart", description: "assumes you only want tributary.init(g) to be run when the restart button is clicked"},
];


tributary.make_context = function(options) {
  //Creates a context from a filename and/or file content
  //{
  //  config: REQUIRED
  //  model: optional, if a CodeModel is passed in, filename and content wont be used
  //  filename: optional, default: inlet.js
  //  content: optional, default: ""
  //  display: optional, default: "d3.select("#display")
  //}
  var context, model,display, type;
  var config = options.config;
  if(options.model) {
    model = options.model;
    filename = model.get("filename");
    type = model.get("type");
  } else {
    var filename, content;
    if(options.filename){
      filename = options.filename;
    } else {
      filename = "inlet.js";
    }
    if(options.content) {
      content = options.content;
    } else {
      content = "";
    }
    //figure out the context to make from the file extension
    var fn = filename.split(".");
    type = fn[fn.length-1];

    //make a code model with the content
    model = new tributary.CodeModel({name: fn[0], filename: filename, code: content});

  }
  if(options.display) {
    display = options.display;
  } else {
    display = d3.select("#display"); 
  }
  
  if(mainfiles.indexOf(filename) >= 0 ) {//  === "inlet.js") {
    context = new tributary.TributaryContext({
      config: config,
      model: model,
      el: display.node()
    });
  } else if(type === "json") {
    model.set("mode", "json")
    context = new tributary.JSONContext({
      config: config,
      model: model,
    });
  } else if(type === "csv") {
    model.set("mode", "text")
    context = new tributary.CSVContext({
      config: config,
      model: model,
    });
  } else if(type === "tsv") {
    model.set("mode", "text")
    context = new tributary.TSVContext({
      config: config,
      model: model,
    });
  } else if(type === "js") {
    context = new tributary.JSContext({
      config: config,
      model: model,
    });
  } else if(type === "css") {
    model.set("mode", "css")
    context = new tributary.CSSContext({
      config: config,
      model: model,
    });
  } else if(type === "html") {
    model.set("mode", "text/html")
    //TODO: enable this when it becomes useful
    context = new tributary.HTMLContext({
      config: config,
      model: model,
      el: display.node()
    });
  } else if(type === "svg" && filename !== "inlet.svg") {
    model.set("mode", "text/html")
    //TODO: enable this when it becomes useful
    context = new tributary.SVGContext({
      config: config,
      model: model,
      el: display.node()
    });
  } 
  else {
  }

  return context;
}


d3.selection.prototype.moveToFront = function() { 
  return this.each(function() { 
    this.parentNode.appendChild(this); 
  }); 
};


tributary.appendSVGFragment = function(element, fragment) {
  //this should allow optional namespace declarations
  var svgpre = "<svg xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink>"; 
  var svgpost = "</svg>";
  var range = document.createRange();
  range.selectNode(element);
  var frag = range.createContextualFragment(svgpre + fragment + svgpost);
  var svgchildren = frag.childNodes[0].childNodes;
  //console.log(svgchildren);
  for(var i = 0, l = svgchildren.length; i < l; i++) {
    element.appendChild(svgchildren[0]);
  }
  
};

//Handlebars getTemplate from:
//http://berzniz.com/post/24743062344/handling-handlebars-js-like-a-pro
//async:
//http://www.jblotus.com/2011/05/24/keeping-your-handlebars-js-templates-organized/
Handlebars.getTemplate = function(name, callback) {
  if (Handlebars.templates === undefined || Handlebars.templates[name] === undefined) {
    $.ajax({
      url : '/static/templates/' + name + '.handlebars',
      success : function(data) {
        if (Handlebars.templates === undefined) {
          Handlebars.templates = {};
        }
        Handlebars.templates[name] = Handlebars.compile(data);
        if (callback) callback(template);
      },
      //async : false
    });
  }
  //return Handlebars.templates[name];
};





