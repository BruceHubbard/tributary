//(function(){
var Tributary = function() {
  var tributary = {};
  tributary.events = _.clone(Backbone.Events);
  tributary.data = {};
  window.trib = {};
  window.trib_options = {};
  window.addEventListener("resize", function(event) {
    tributary.events.trigger("resize", event);
  });
  var mainfiles = [ "inlet.js", "inlet.coffee", "sinwaves.js", "squarecircle.js" ];
  tributary.displays = [ {
    name: "svg",
    description: "creates an <svg> element for you to use"
  }, {
    name: "canvas",
    description: "creates a <canvas> element and gives you a Context for the canvas"
  }, {
    name: "webgl",
    description: "gives you a Three.js WebGLRenderer scene"
  }, {
    name: "html",
    description: "gives you <div id=display>"
  } ];
  tributary.time_controls = [ {
    name: "play",
    description: "gives you a play button, and tributary.t. if you provide tributary.run(g,t) it will be executed in a run loop"
  }, {
    name: "loop",
    description: "gives you a loop where tributary.t goes from 0 to 1."
  }, {
    name: "restart",
    description: "assumes you only want tributary.init(g) to be run when the restart button is clicked"
  } ];
  tributary.make_context = function(options) {
    var context, model, display, type;
    var config = options.config;
    if (options.model) {
      model = options.model;
      filename = model.get("filename");
      type = model.get("type");
    } else {
      var filename, content;
      if (options.filename) {
        filename = options.filename;
      } else {
        filename = "inlet.js";
      }
      if (options.content) {
        content = options.content;
      } else {
        content = "";
      }
      var fn = filename.split(".");
      type = fn[fn.length - 1];
      model = new tributary.CodeModel({
        name: fn[0],
        filename: filename,
        code: content
      });
    }
    if (options.display) {
      display = options.display;
    } else {
      display = d3.select("#display");
    }
    model.set("type", type);
    if (mainfiles.indexOf(filename) >= 0) {
      context = new tributary.TributaryContext({
        config: config,
        model: model,
        el: display.node()
      });
    } else if (type === "json") {
      model.set("mode", "json");
      context = new tributary.JSONContext({
        config: config,
        model: model
      });
    } else if (type === "csv") {
      model.set("mode", "text");
      context = new tributary.CSVContext({
        config: config,
        model: model
      });
    } else if (type === "tsv") {
      model.set("mode", "text");
      context = new tributary.TSVContext({
        config: config,
        model: model
      });
    } else if (type === "js") {
      context = new tributary.JSContext({
        config: config,
        model: model
      });
    } else if (type === "coffee") {
      model.set("mode", "coffeescript");
      context = new tributary.CoffeeContext({
        config: config,
        model: model
      });
    } else if (type === "css") {
      model.set("mode", "css");
      context = new tributary.CSSContext({
        config: config,
        model: model
      });
    } else if (type === "html") {
      model.set("mode", "text/html");
      context = new tributary.HTMLContext({
        config: config,
        model: model,
        el: display.node()
      });
    } else if (type === "svg" && filename !== "inlet.svg") {
      model.set("mode", "text/html");
      context = new tributary.SVGContext({
        config: config,
        model: model,
        el: display.node()
      });
    } else {}
    return context;
  };
  d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
      this.parentNode.appendChild(this);
    });
  };
  tributary.appendSVGFragment = function(element, fragment) {
    var svgpre = "<svg xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink>";
    var svgpost = "</svg>";
    var range = document.createRange();
    range.selectNode(element);
    var frag = range.createContextualFragment(svgpre + fragment + svgpost);
    var svgchildren = frag.childNodes[0].childNodes;
    for (var i = 0, l = svgchildren.length; i < l; i++) {
      element.appendChild(svgchildren[0]);
    }
  };
  Handlebars.getTemplate = function(name, callback) {
    if (Handlebars.templates === undefined || Handlebars.templates[name] === undefined) {
      $.ajax({
        url: "/static/templates/" + name + ".handlebars",
        success: function(data) {
          if (Handlebars.templates === undefined) {
            Handlebars.templates = {};
          }
          Handlebars.templates[name] = Handlebars.compile(data);
          if (callback) callback(template);
        }
      });
    }
  };
  tributary.CodeModel = Backbone.Model.extend({
    defaults: {
      code: "",
      filename: "inlet.js",
      name: "inlet",
      type: "js",
      mode: "javascript"
    },
    initialize: function() {
      this.binder();
    },
    binder: function() {
      this.on("error", this.handle_error);
    },
    handle_error: function(e) {
      if (tributary.trace) {
        console.trace();
        console.log(e);
      }
    },
    handle_coffee: function() {
      var js = this.get("code");
      if (this.get("mode") === "coffeescript") {
        js = CoffeeScript.compile(js, {
          bare: true
        });
      }
      return js;
    },
    local_storage: function(key) {
      if (!key) {
        key = "";
      }
      var ep = this.get("filename") + "/code/" + key;
      return localStorage[ep];
    },
    set_local_storage: function(code, key) {
      var ep = this.get("filename") + "/code/" + key;
      localStorage[ep] = code;
    }
  });
  tributary.CodeModels = Backbone.Collection.extend({
    model: tributary.CodeModel
  });
  tributary.Config = Backbone.Model.extend({
    defaults: {
      description: "Tributary inlet",
      endpoint: "tributary",
      display: "svg",
      "public": true,
      require: [],
      fileconfigs: {},
      tab: "edit",
      display_percent: .7,
      play: false,
      loop: false,
      restart: false,
      autoinit: true,
      pause: true,
      loop_type: "period",
      bv: false,
      nclones: 15,
      clone_opacity: .4,
      duration: 3e3,
      ease: "linear",
      dt: .01
    },
    require: function(callback, ret) {
      var modules = this.get("require");
      var scripts = _.pluck(modules, "url");
      var rcb = function() {
        return callback(ret, arguments);
      };
      require(scripts, rcb);
    },
    initialize: function() {
      this.on("hide", function() {
        this.contexts.forEach(function(context) {
          context.model.trigger("hide");
        });
      }, this);
    }
  });
  tributary.ConfigView = Backbone.View.extend({
    initialize: function() {},
    render: function() {
      var that = this;
      var template = Handlebars.templates.config;
      var context = {
        displays: tributary.displays,
        time_controls: tributary.time_controls,
        requires: this.model.get("require")
      };
      $(this.el).html(template(context));
      var displays = d3.select(this.el).select(".displaycontrols").selectAll("div.config");
      var initdisplay = this.model.get("display");
      displays.datum(function() {
        return this.dataset;
      });
      displays.filter(function(d) {
        return d.name === initdisplay;
      }).classed("config_active", true);
      displays.on("click", function(d) {
        d3.select(this.parentNode).selectAll("div.config").classed("config_active", false);
        d3.select(this).classed("config_active", true);
        that.model.set("display", d.name);
        tributary.events.trigger("execute");
      });
      var timecontrols = d3.select(this.el).select(".timecontrols").selectAll("div.config");
      timecontrols.datum(function() {
        return this.dataset;
      });
      timecontrols.filter(function(d) {
        return that.model.get(d.name);
      }).classed("config_active", true);
      timecontrols.on("click", function(d) {
        var tf = !that.model.get(d.name);
        d3.select(this).classed("config_active", tf);
        that.model.set(d.name, tf);
      });
      var editorcontrols = d3.select(this.el).select(".editorcontrols");
      editorcontrols.selectAll("div.config").on("click", function(d) {
        if ($(this).attr("data-name") == "log-errors") {
          if (tributary.hint == true && tributary.trace == true) {
            $(this).removeClass("config_active");
            tributary.hint = false;
            tributary.trace = false;
            tributary.events.trigger("execute");
          } else {
            tributary.hint = true;
            tributary.trace = true;
            tributary.events.trigger("execute");
            $(this).addClass("config_active");
          }
        }
      });
      var require = d3.select(this.el).select(".requirecontrols");
      var plus = require.selectAll(".plus");
      var add = require.selectAll(".tb_add");
      var name_input = require.select(".tb_add").select("input.name");
      var url_input = require.select(".tb_add").select("input.url");
      require.selectAll("div.config").datum(function() {
        return this.dataset;
      }).select("span.delete").datum(function() {
        return this.dataset;
      }).on("click", function(d) {
        var reqs = that.model.get("require");
        var ind = reqs.indexOf(d);
        reqs.splice(ind, 1);
        that.model.set("require", reqs);
        that.$el.empty();
        that.render();
        add.style("display", "none");
      });
      require.selectAll("div.config").on("click", function(d) {
        add.style("display", "");
        name_input.node().value = d.name;
        url_input.node().value = d.url;
        var done = function() {
          var reqs = that.model.get("require");
          var req = _.find(reqs, function(r) {
            return r.name === d.name;
          });
          req.name = name_input.node().value;
          req.url = url_input.node().value;
          that.model.set("require", reqs);
          that.model.require(function() {}, reqs);
          that.$el.empty();
          that.render();
        };
        name_input.on("keypress", function() {
          if (d3.event.charCode === 13) {
            done();
          }
        });
        url_input.on("keypress", function() {
          if (d3.event.charCode === 13) {
            done();
          }
        });
      });
      plus.on("click", function() {
        add.style("display", "");
        name_input.node().focus();
        var done = function() {
          var req = {
            name: name_input.node().value,
            url: url_input.node().value
          };
          var reqs = that.model.get("require");
          reqs.push(req);
          that.model.set("require", reqs);
          that.model.require(function() {}, reqs);
          that.$el.empty();
          that.render();
        };
        name_input.on("keypress", function() {
          if (d3.event.charCode === 13) {
            done();
          }
        });
        url_input.on("keypress", function() {
          if (d3.event.charCode === 13) {
            done();
          }
        });
      });
    }
  });
  tributary.Context = Backbone.View.extend({
    initialize: function() {},
    execute: function() {},
    render: function() {}
  });
  tributary.TributaryContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
      tributary.events.on("execute", this.execute, this);
      if (!tributary.__config__) tributary.__config__ = this.options.config;
      this.model.on("change:code", function() {
        if (!window.onbeforeunload) {
          $(window).on("beforeunload", function() {
            return "Are you sure you want to leave?";
          });
        }
      }, this);
      this.config = this.options.config;
      this.config.on("change:display", this.set_display, this);
      var config = this.config;
      tributary.init = undefined;
      tributary.run = undefined;
      tributary.loop = config.get("loop");
      tributary.autoinit = config.get("autoinit");
      tributary.pause = config.get("pause");
      tributary.loop_type = config.get("loop_type");
      tributary.bv = config.get("bv");
      tributary.nclones = config.get("nclones");
      tributary.clone_opacity = config.get("clone_opacity");
      tributary.duration = config.get("duration");
      tributary.ease = d3.ease(config.get("ease"));
      tributary.t = 0;
      tributary.dt = config.get("dt");
      tributary.reverse = false;
      tributary.useThreejsControls = true;
      tributary.render = function() {};
      tributary.execute = function() {
        if (tributary.run !== undefined) {
          var t = tributary.t;
          if (tributary.loop) {
            t = tributary.ease(tributary.t);
          }
          tributary.run(tributary.g, t, 0);
        }
      };
      tributary.timer = {
        then: new Date,
        duration: tributary.duration,
        ctime: tributary.t
      };
      d3.timer(function() {
        tributary.render();
        if (tributary.pause) {
          return false;
        }
        var now = new Date;
        var dtime = now - tributary.timer.then;
        var dt;
        if (tributary.loop) {
          if (tributary.reverse) {
            dt = tributary.timer.ctime * dtime / tributary.timer.duration * -1;
          } else {
            dt = (1 - tributary.timer.ctime) * dtime / tributary.timer.duration;
          }
          tributary.t = tributary.timer.ctime + dt;
          if (tributary.t >= 1 || tributary.t <= 0 || tributary.t === "NaN") {
            if (tributary.loop_type === "period") {
              tributary.t = 0;
              tributary.timer.then = new Date;
              tributary.timer.duration = tributary.duration;
              tributary.timer.ctime = tributary.t;
              tributary.reverse = false;
            } else if (tributary.loop_type === "pingpong") {
              tributary.t = !tributary.reverse;
              tributary.timer.then = new Date;
              tributary.timer.duration = tributary.duration;
              tributary.timer.ctime = tributary.t;
              tributary.reverse = !tributary.reverse;
            } else {
              if (tributary.t !== 0) {
                tributary.t = 1;
                tributary.pause = true;
              }
            }
          }
          if (tributary.t === true) {
            tributary.t = 1;
          }
          if (tributary.t === false) {
            tributary.t = 0;
          }
        } else {
          tributary.t += tributary.dt;
        }
        tributary.execute();
        config.trigger("tick", tributary.t);
      });
    },
    execute: function() {
      var js = this.model.handle_coffee();
      if (js.length > 0 && this.model.get("type") !== "coffee") {
        var hints = JSHINT(js, {
          asi: true,
          laxcomma: true,
          laxbreak: true,
          loopfunc: true,
          smarttabs: true,
          sub: true
        });
        if (!hints) {
          this.model.trigger("jshint", JSHINT.errors);
        } else {
          this.model.trigger("nojshint");
        }
      }
      try {
        tributary.initialize = new Function("g", "tributary", js);
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      try {
        window.trib = {};
        window.trib_options = {};
        trib = window.trib;
        trib_options = window.trib_options;
        if (tributary.autoinit) {
          tributary.clear();
          tributary.events.trigger("prerender");
        }
        if (this.clones) {
          $(this.clones.node()).empty();
        }
        if (tributary.bv) {
          this.make_clones();
        }
        tributary.initialize(tributary.g, tributary);
        if (tributary.autoinit && tributary.init !== undefined) {
          tributary.init(tributary.g, 0);
        }
        tributary.execute();
      } catch (err) {
        this.model.trigger("error", err);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {
      this.set_display();
    },
    set_display: function() {
      var that = this;
      this.$el.empty();
      var display = this.config.get("display");
      if (display === "svg") {
        this.make_svg();
      } else if (display === "canvas") {
        this.make_canvas();
      } else if (display === "webgl") {
        this.make_webgl();
      } else if (display === "div") {
        this.g = d3.select(this.el);
        tributary.g = this.g;
        tributary.clear = function() {
          that.$el.empty();
        };
      } else {
        tributary.clear = function() {
          that.$el.empty();
        };
      }
    },
    make_svg: function() {
      this.svg = d3.select(this.el).append("svg").attr({
        xmlns: "http://www.w3.org/2000/svg",
        xlink: "http://www.w3.org/1999/xlink",
        "class": "tributary_svg"
      });
      tributary.g = this.svg;
      tributary.clear = function() {
        $(tributary.g.node()).empty();
      };
    },
    make_canvas: function() {
      tributary.clear = function() {
        tributary.canvas.width = tributary.sw;
        tributary.canvas.height = tributary.sh;
        tributary.ctx.clearRect(0, 0, tributary.sw, tributary.sh);
      };
      tributary.canvas = d3.select(this.el).append("canvas").classed("tributary_canvas", true).node();
      tributary.ctx = tributary.canvas.getContext("2d");
      tributary.g = tributary.ctx;
    },
    make_clones: function() {
      this.clones = this.svg.selectAll("g.clones").data([ 0 ]);
      this.clones.enter().append("g").attr("class", "clones");
      tributary.g = this.svg.selectAll("g.delta").data([ 0 ]);
      tributary.g.enter().append("g").attr("class", "delta");
      var frames = d3.range(tributary.nclones);
      var gf = this.clones.selectAll("g.bvclone").data(frames).enter().append("g").attr("class", "bvclone").style("opacity", tributary.clone_opacity);
      gf.each(function(d, i) {
        var j = i + 1;
        var frame = d3.select(this);
        tributary.init(frame, j);
        var t = tributary.ease(j / (tributary.nclones + 1));
        tributary.run(frame, t, j);
      });
    },
    make_webgl: function() {
      container = this.el;
      tributary.camera = new THREE.PerspectiveCamera(70, tributary.sw / tributary.sh, 1, 1e3);
      tributary.camera.position.y = 150;
      tributary.camera.position.z = 500;
      tributary.scene = new THREE.Scene;
      THREE.Object3D.prototype.clear = function() {
        var children = this.children;
        var i;
        for (i = children.length - 1; i >= 0; i--) {
          var child = children[i];
          child.clear();
          this.remove(child);
        }
      };
      tributary.renderer = new THREE.WebGLRenderer;
      tributary.renderer.setSize(tributary.sw, tributary.sh);
      container.appendChild(tributary.renderer.domElement);
      var controls = new THREE.TrackballControls(tributary.camera);
      controls.target.set(0, 0, 0);
      controls.rotateSpeed = 1;
      controls.zoomSpeed = 1.2;
      controls.panSpeed = .8;
      controls.noZoom = false;
      controls.noPan = false;
      controls.staticMoving = false;
      controls.dynamicDampingFactor = .15;
      tributary.controls = controls;
      tributary.render = function() {
        if (tributary.useThreejsControls) {
          tributary.controls.update();
        }
        tributary.renderer.render(tributary.scene, tributary.camera);
      };
      tributary.render();
      function onWindowResize() {
        windowHalfX = tributary.sw / 2;
        windowHalfY = tributary.sh / 2;
        tributary.camera.aspect = tributary.sw / tributary.sh;
        tributary.camera.updateProjectionMatrix();
        tributary.renderer.setSize(tributary.sw, tributary.sh);
      }
      tributary.events.on("resize", onWindowResize, false);
      tributary.clear = function() {
        tributary.scene.clear();
      };
    }
  });
  tributary.JSONContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", this.execute, this);
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
    },
    execute: function() {
      try {
        var json = JSON.parse(this.model.get("code"));
        tributary[this.model.get("name")] = json;
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {}
  });
  tributary.JSContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", this.execute, this);
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
    },
    execute: function() {
      var js = this.model.get("code");
      if (js.length > 0) {
        var hints = JSHINT(js, {
          asi: true,
          laxcomma: true,
          laxbreak: true,
          loopfunc: true,
          smarttabs: true,
          sub: true
        });
        if (!hints) {
          this.model.trigger("jshint", JSHINT.errors);
        } else {
          this.model.trigger("nojshint");
        }
      }
      try {
        eval(js);
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {}
  });
  tributary.CoffeeContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", this.execute, this);
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
    },
    execute: function() {
      var js = this.model.handle_coffee();
      try {
        eval(js);
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {}
  });
  tributary.CSVContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", this.execute, this);
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
    },
    execute: function() {
      try {
        var json = d3.csv.parse(this.model.get("code"));
        tributary[this.model.get("name")] = json;
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {}
  });
  tributary.TSVContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", this.execute, this);
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
    },
    execute: function() {
      try {
        var json = d3.tsv.parse(this.model.get("code"));
        tributary[this.model.get("name")] = json;
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {}
  });
  tributary.CSSContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", this.execute, this);
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
    },
    execute: function() {
      try {
        this.el.textContent = this.model.get("code");
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {
      this.el = d3.select("head").selectAll("style.csscontext").data([ this.model ], function(d) {
        return d.cid;
      }).enter().append("style").classed("csscontext", true).attr({
        type: "text/css"
      }).node();
    }
  });
  tributary.HTMLContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
      tributary.events.on("prerender", this.execute, this);
    },
    execute: function() {
      try {
        $(this.el).append(this.model.get("code"));
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {}
  });
  tributary.SVGContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", function() {
        tributary.events.trigger("execute");
      });
      tributary.events.on("prerender", this.execute, this);
    },
    execute: function() {
      try {
        var svg = d3.select(this.el).select("svg").node();
        tributary.appendSVGFragment(svg, this.model.get("code"));
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {}
  });
  tributary.PanelView = Backbone.View.extend({
    initialize: function() {},
    render: function() {
      var that = this;
      var panel_data = [ "edit", "config" ];
      var template = Handlebars.templates.panel;
      var html = template(panel_data);
      this.$el.html(html);
      panel = d3.select("#panel");
      panel_gui = d3.selectAll("#file-list");
      var panel_buttons = panel_gui.selectAll("#file-list li").on("click", function(d) {
        tributary.events.trigger("show", this.dataset.name);
      });
      tributary.events.on("show", function(name) {
        $(".tb_panel").children(".panel").css("display", "none");
        panel.select(".tb_" + name).style("display", "");
        panel_gui.selectAll("div.pb").classed("gui_active", false);
        panel_gui.select(".tb_" + name + "_tab").classed("gui_active", true);
      });
      tributary.events.trigger("show", "edit");
    }
  });
  tributary.make_editor = function(options) {
    var editorParent = options.parent || tributary.edit;
    var model = options.model;
    if (options.container) {
      container = options.container;
    } else {
      container = editorParent.append("div").attr("id", model.cid);
    }
    container = d3.select("#code");
    var editor;
    editor = new tributary.Editor({
      el: container.node(),
      model: model
    });
    editor.render();
    return editor;
  };
  tributary.Editor = Backbone.View.extend({
    initialize: function() {
      this.model.on("show", function() {
        d3.select(this.el).style("display", "");
      }, this);
      this.model.on("hide", function() {
        d3.select(this.el).style("display", "none");
      }, this);
      this.model.on("delete", function() {
        this.$el.remove();
      }, this);
    },
    getConfig: function() {
      var fileconfigs = tributary.__config__.get("fileconfigs");
      var fileconfig = fileconfigs[this.model.get("filename")];
      if (!fileconfig) return this.defaultConfig();
      return fileconfig;
    },
    setConfig: function(key, value) {
      var fileconfigs = tributary.__config__.get("fileconfigs");
      var fileconfig = fileconfigs[this.model.get("filename")];
      fileconfig[key] = value;
      var fileconfigs = tributary.__config__.set("fileconfigs", fileconfigs);
    },
    defaultConfig: function() {
      var fileconfigs = tributary.__config__.get("fileconfigs");
      var fileconfig = {
        "default": true,
        vim: false,
        emacs: false,
        fontSize: 12
      };
      fileconfigs[this.model.get("filename")] = fileconfig;
      var fileconfigs = tributary.__config__.set("fileconfigs", fileconfigs);
      return fileconfig;
    },
    render: function() {
      var that = this;
      var dis = d3.select(this.el).classed("editor", true);
      var template = Handlebars.templates.editor;
      var html = template(this.getConfig());
      this.$el.html(html);
      filetype = that.model.get("filename").split(".")[1];
      if (filetype == "js") {
        var editor_theme = "lesser-dark";
      } else if (filetype == "svg") {
        var editor_theme = "vibrant-ink";
      } else if (filetype == "html") {
        var editor_theme = "ambiance";
      } else if (filetype == "coffee") {
        var editor_theme = "elegant";
      } else if (filetype == "css") {
        var editor_theme = "elegant";
      } else {
        var editor_theme = "lesser-dark";
      }
      var codemirror_options = {
        mode: that.model.get("mode"),
        theme: editor_theme,
        lineNumbers: true
      };
      if (that.model.get("mode") === "json") {
        codemirror_options.mode = "javascript";
        codemirror_options.json = true;
      }
      this.cm = CodeMirror(this.el, codemirror_options);
      this.cm.on("change", function() {
        var code = that.cm.getValue();
        that.model.set("code", code);
      });
      this.cm.setValue(this.model.get("code"));
      this.inlet = Inlet(this.cm);
      this.model.on("error", function() {
        d3.select(that.el).select(".CodeMirror-gutter").classed("error", true);
      });
      this.model.on("noerror", function() {
        d3.select(that.el).select(".CodeMirror-gutter").classed("error", false);
      });
      var toolbar = dis.select(".toolbar");
      var settings = dis.select(".settings").on("click", function() {
        toolbar.classed("hidden", !toolbar.classed("hidden"));
        settings.classed("active-settings", !toolbar.classed("hidden"));
      });
      toolbar.selectAll(".radio").on("change", function() {
        that.setConfig("default", false);
        that.setConfig("vim", false);
        that.setConfig("emacs", false);
        that.setConfig(this.value, true);
        that.cm.setOption("keyMap", this.value);
      });
      toolbar.select(".plusFontSize").on("click", function() {
        var fileconfig = that.getConfig();
        var fontSize = fileconfig.fontSize + 1;
        that.setConfig("fontSize", fontSize);
        var wrap = that.cm.getWrapperElement();
        d3.select(wrap).select(".CodeMirror-scroll").style({
          "font-size": fontSize + "px",
          "line-height": fontSize + "px"
        });
        that.cm.refresh();
      });
      toolbar.select(".minusFontSize").on("click", function() {
        var fileconfig = that.getConfig();
        var fontSize = fileconfig.fontSize - 1;
        that.setConfig("fontSize", fontSize);
        var wrap = that.cm.getWrapperElement();
        d3.select(wrap).select(".CodeMirror-scroll").style({
          "font-size": fontSize + "px",
          "line-height": fontSize + "px"
        });
        that.cm.refresh();
      });
      var fileconfig = that.getConfig();
      var fontSize = fileconfig.fontSize;
      var wrap = that.cm.getWrapperElement();
      d3.select(wrap).select(".CodeMirror-scroll").style({
        "font-size": fontSize + "px",
        "line-height": fontSize + "px"
      });
      that.cm.refresh();
    }
  });
  tributary.gist = function(id, callback) {
    tributary.gistid = id;
    var ret = {};
    var cachebust = "?cachebust=" + Math.random() * 0xf12765df4c9b2;
    var url = "https://api.github.com/gists/" + id + cachebust;
    $.ajax({
      url: url,
      contentType: "application/json",
      dataType: "json",
      success: handle_gist,
      error: function(e) {
        console.log(e);
        url = "/gist/" + id + cachebust;
        $.ajax({
          url: url,
          contentType: "application/json",
          dataType: "json",
          success: handle_gist,
          error: function(er) {
            console.log(er);
          }
        });
      }
    });
    function handle_gist(data) {
      ret.gist = data;
      if (data.user === null || data.user === undefined) {
        ret.user = {
          login: "anon",
          url: "",
          userid: -1
        };
      } else {
        ret.user = data.user;
      }
      var config;
      try {
        config = data.files["config.json"];
      } catch (er) {
        config = false;
      }
      if (config) {
        try {
          ret.config = new tributary.Config(JSON.parse(config.content));
        } catch (e) {
          ret.config = new tributary.Config;
        }
      } else {
        ret.config = new tributary.Config;
      }
      var files = _.keys(data.files);
      fileconfigs = ret.config.get("fileconfigs") || {};
      ret.models = new tributary.CodeModels;
      var fsplit, model, context, i = 0, ext;
      files.forEach(function(f) {
        fsplit = f.split(".");
        ext = fsplit[fsplit.length - 1];
        if (f !== "config.json") {
          model = new tributary.CodeModel({
            filename: f,
            name: fsplit[0],
            code: data.files[f].content,
            type: ext
          });
          ret.models.add(model);
        }
        if (!fileconfigs[f]) {
          fileconfigs[f] = {
            "default": true,
            vim: false,
            emacs: false,
            fontSize: 12
          };
        }
      });
      ret.config.set("fileconfigs", fileconfigs);
      ret.config.require(callback, ret);
    }
  };
  tributary.save_gist = function(config, saveorfork, callback) {
    var oldgist = tributary.gistid || "";
    var gist = {
      description: config.get("description"),
      "public": config.get("public"),
      files: {}
    };
    config.contexts.forEach(function(context) {
      gist.files[context.model.get("filename")] = {
        content: context.model.get("code")
      };
    });
    if (config.todelete) {
      config.todelete.forEach(function(filename) {
        gist.files[filename] = null;
      });
    }
    gist.files["config.json"] = {
      content: JSON.stringify(config.toJSON())
    };
    var url;
    if (saveorfork === "save") {
      url = "/tributary/save";
    } else if (saveorfork === "fork") {
      url = "/tributary/fork";
    }
    if (oldgist.length > 4) {
      url += "/" + oldgist;
    }
    var that = this;
    $.post(url, {
      gist: JSON.stringify(gist)
    }, function(data) {
      if (typeof data === "string") {
        data = JSON.parse(data);
      }
      var newgist = data.id;
      var newurl = "/inlet/" + newgist;
      callback(newurl, newgist);
    });
  };
  tributary.login_gist = function(loginorout, callback) {
    var url;
    if (loginorout) {
      url = "/github-logout";
    } else {
      url = "/github-login";
    }
    url += "/inlet";
    if (tributary.gistid) {
      url += "/" + tributary.gistid;
    }
    callback(url);
  };
  tributary.FilesView = Backbone.View.extend({
    initialize: function() {},
    render: function() {
      var that = this;
      var template = Handlebars.templates.files;
      var contexts = _.map(tributary.__config__.contexts, function(ctx) {
        return ctx.model.toJSON();
      });
      contexts = contexts.sort(function(a, b) {
        if (a.filename < b.filename) return -1;
        return 1;
      });
      var inlet = _.find(contexts, function(d) {
        return d.filename === "inlet.js" || d.filename === "inlet.coffee";
      });
      if (inlet) {
        contexts.splice(contexts.indexOf(inlet), 1);
        contexts.unshift(inlet);
      }
      console.log("CONTEXT", contexts);
      var filelist = d3.select("#file-list").selectAll("li").data(contexts);
      filelist.enter().append("li").html(function(d, i) {
        var fileTabText = d.filename;
        fileTabText += ' <i class="icon-cancel delete-file"></i>';
        return fileTabText;
      }).attr("class", function(d) {
        return "file " + "filetype-" + d.type;
      });
      filelist.exit().remove();
      var fvs = d3.select(this.el).selectAll("li");
      fvs.on("click", function(d) {
        var filename = this.dataset.filename;
        if (that.model) {
          var ctx = _.find(tributary.__config__.contexts, function(d) {
            return d.model.get("filename") === filename;
          });
          that.model.trigger("hide");
          ctx.model.trigger("show");
        }
        tributary.events.trigger("show", "edit");
      });
      fvs.select(".delete-file").style("z-index", 1e3).on("click", function() {
        var dataset = this.parentNode.dataset;
        var filename = dataset.filename;
        var name = dataset.filename.split(".")[0];
        delete that.model;
        tributary.__config__.unset(filename);
        var context = _.find(tributary.__config__.contexts, function(d) {
          return d.model.get("filename") === filename;
        });
        context.model.trigger("delete");
        var ind = tributary.__config__.contexts.indexOf(context);
        tributary.__config__.contexts.splice(ind, 1);
        delete context;
        if (!tributary.__config__.todelete) {
          tributary.__config__.todelete = [];
        }
        tributary.__config__.todelete.push(filename);
        d3.select(".tb_files").selectAll("div.fv").each(function() {
          if (this.dataset.filename === filename) {
            $(this).remove();
          }
        });
        var othertab = tributary.__config__.contexts[0].model;
        othertab.trigger("show");
        d3.event.stopPropagation();
      });
      var plus = d3.select(this.el).selectAll("div.plus").on("click", function() {
        var input = d3.select(this).select("input").style("display", "inline-block");
        input.node().focus();
        input.on("keypress", function() {
          if (d3.event.charCode === 13) {
            var context = tributary.make_context({
              filename: input.node().value,
              config: tributary.__config__
            });
            if (context) {
              tributary.__config__.contexts.push(context);
              context.render();
              context.execute();
              var editor = tributary.make_editor({
                model: context.model
              });
              that.$el.empty();
              that.render();
              tributary.__config__.contexts.forEach(function(c) {
                c.model.trigger("hide");
              });
              context.model.trigger("show");
              editor.cm.focus();
              fvs.attr("class", function(d, i) {
                var filetype = this.dataset.filename.split(".")[1];
                return "fv type-" + filetype;
              });
            } else {
              input.classed("input_error", true);
            }
          }
        });
      });
    }
  });
  tributary.FileView = Backbone.View.extend({
    render: function() {}
  });
  tributary.ControlsView = Backbone.View.extend({
    initialize: function() {
      this.model.on("change:play", this.play_button, this);
      this.model.on("change:loop", this.time_slider, this);
      this.model.on("change:restart", this.restart_button, this);
    },
    render: function() {
      var del = d3.select(this.el);
      del.append("div").attr("id", "time_controls");
      del.append("div").attr("id", "user_controls");
      del.append("div").attr("id", "time_options");
      this.play_button();
      this.time_slider();
      this.restart_button();
    },
    play_button: function() {
      var tc = d3.select(this.el).select("#time_controls");
      if (this.model.get("play")) {
        var pb = tc.append("button").classed("play", true).classed("button_on", true).text("Play");
        pb.on("click", function(event) {
          if (!tributary.pause) {
            pb.classed("playing", false);
            pb.text("Play");
          } else if (tributary.pause) {
            pb.classed("playing", true);
            pb.text("Pause");
          }
          if (tributary.t < 1 || !tributary.loop) {
            tributary.pause = !tributary.pause;
            if (!tributary.pause) {
              tributary.timer.then = new Date;
              tributary.timer.duration = (1 - tributary.t) * tributary.duration;
              tributary.timer.ctime = tributary.t;
            }
          }
        });
      } else {
        tc.select("button.play").remove();
      }
    },
    time_slider: function() {
      tributary.loop = this.model.get("loop");
      var tc = d3.select(this.el).select("#time_controls");
      if (tributary.loop) {
        var ts = tc.append("input").attr({
          type: "range",
          min: 0,
          max: 1,
          step: .01,
          value: 0,
          name: "time"
        }).classed("time_slider", true);
        $(ts.node()).on("change", function() {
          tributary.t = parseFloat(this.value);
          if (tributary.pause) {
            tributary.execute();
          }
        });
        this.model.on("tick", function(t) {
          $(ts.node()).attr("value", tributary.t);
        });
        if (this.model.get("display") === "svg") {
          var bv = tc.append("button").classed("bv", true).classed("button_on", true).text("BV");
          bv.on("click", function() {
            tributary.bv = !tributary.bv;
            tributary.events.trigger("execute");
          });
        }
      } else {
        tributary.bv = false;
        tc.select("input.time_slider").remove();
        tc.select("button.bv").remove();
      }
    },
    restart_button: function() {
      var that = this;
      var tc = d3.select(this.el).select("#time_controls");
      if (this.model.get("restart")) {
        tributary.autoinit = false;
        var rb = tc.append("button").classed("restart", true).classed("button_on", true).text("Restart");
        rb.on("click", function(event) {
          tributary.clear();
          tributary.initialize(tributary.g, tributary);
          tributary.init(tributary.g);
          tributary.execute();
        });
      } else {
        tributary.autoinit = true;
        tc.select("button.restart").remove();
      }
    }
  });
  tributary.batch = {};
  tributary.batch._execute = function() {
    var funcs = _.functions(this);
    _.each(funcs, function(f) {
      if (f !== "_execute") {
        tributary.batch[f]();
      }
    });
  };
  tributary.ui = {};
  var display, panel_gui, panel, panel_handle, page, header;
  tributary.ui.setup = function() {
    tributary.panel = new tributary.PanelView({
      el: ".tb_panel"
    });
    tributary.panel.render();
    display = d3.select("#display");
    panel = d3.select("#panel");
    panel_gui = d3.selectAll("div.tb_panel_gui");
    panelfile_gui = d3.select("#file-list");
    panel_handle = d3.select(".tb_panel_handle");
    page = d3.select("#container");
    header = d3.select("#title");
    tributary.dims = {
      display_percent: .7,
      page_width: 0,
      page_height: 0,
      display_width: 0,
      display_height: 0,
      panel_width: 0,
      panel_height: 0,
      panel_gui_width: 0,
      panel_gui_height: 31
    };
    tributary.events.on("resize", function() {
      if ($("#display").width() > 767) {
        tributary.sw = $("#display").width() - $("#panel").width();
      } else {
        tributary.sw = $("#display").width();
      }
      if ($("#container").hasClass("fullscreen")) {
        console.log("Fullscreen");
        tributary.sw = $("#display").width();
      }
      tributary.sh = $("#display").height();
      tributary.events.trigger("execute");
    });
    tributary.events.trigger("resize");
    var ph_drag = d3.behavior.drag().on("drag", function() {
      var dx = d3.event.dx / tributary.dims.page_width;
      if (tributary.dims.display_percent + dx >= 0 && tributary.dims.display_percent + dx <= 1) {
        tributary.dims.display_percent += dx;
      }
      tributary.events.trigger("resize");
    });
    panel_handle.call(ph_drag);
  };
  tributary.ui.assemble = function(gistid) {
    tributary.trace = false;
    tributary.hint = false;
    if (gistid.length > 0) {
      tributary.gist(gistid, _assemble);
    } else {
      var ret = {};
      ret.config = new tributary.Config;
      ret.models = new tributary.CodeModels(new tributary.CodeModel);
      _assemble(ret);
    }
  };
  function _assemble(ret) {
    var config = ret.config;
    tributary.__config__ = config;
    config.contexts = [];
    var context;
    var edel;
    var editor;
    var type;
    var endpoint = config.get("endpoint");
    if (tributary.endpoint) {
      endpoint = tributary.endpoint;
    }
    if (endpoint === "delta") {
      config.set("display", "svg");
      config.set("play", true);
      config.set("loop", true);
      config.set("autoinit", true);
    } else if (endpoint === "cypress") {
      config.set("display", "canvas");
      config.set("play", true);
      config.set("autoinit", true);
    } else if (endpoint === "hourglass") {
      config.set("display", "svg");
      config.set("play", true);
      config.set("autoinit", true);
    } else if (endpoint === "curiosity") {
      config.set("display", "webgl");
      config.set("play", true);
      config.set("autoinit", true);
    } else if (endpoint === "bigfish") {
      config.set("display", "svg");
      config.set("play", true);
      config.set("autoinit", false);
      config.set("restart", true);
    } else if (endpoint === "fly") {
      config.set("display", "canvas");
      config.set("play", true);
      config.set("autoinit", false);
      config.set("restart", true);
    } else if (endpoint === "ocean") {
      config.set("display", "div");
    }
    if (!config.get("display")) {
      config.set("display", "svg");
    }
    config.set("endpoint", "");
    var edit = panel.select(".tb_edit");
    tributary.edit = edit;
    ret.models.each(function(m) {
      type = m.get("type");
      context = tributary.make_context({
        config: config,
        model: m,
        display: display
      });
      if (context) {
        config.contexts.push(context);
        context.render();
        if (mainfiles.indexOf(m.get("filename")) < 0) {
          context.execute();
        }
        context.editor = tributary.make_editor({
          model: m,
          parent: edit
        });
        m.trigger("hide");
      }
    });
    config.contexts.forEach(function(c) {
      if (mainfiles.indexOf(c.model.get("filename")) >= 0) {
        c.model.trigger("show");
        tributary.autoinit = true;
        c.execute();
        tributary.autoinit = config.get("autoinit");
      }
    });
    var config_view = new tributary.ConfigView({
      el: ".tb_config",
      model: config
    });
    config_view.render();
    var files_view = new tributary.FilesView({
      el: "#file-list",
      model: config
    });
    files_view.render();
    var controls_view = new tributary.ControlsView({
      el: ".tb_controls",
      model: config
    });
    controls_view.render();
    setup_header(ret);
    tributary.events.trigger("show", config.get("tab"));
    tributary.events.on("show", function(name) {
      config.set("tab", name);
    });
    tributary.dims.display_percent = config.get("display_percent");
    tributary.events.trigger("resize");
    tributary.events.on("resize", function() {
      config.set("display_percent", tributary.dims.display_percent);
    });
    if (config.get("hidepanel")) {
      tributary.events.trigger("hidepanel");
    } else {
      tributary.events.trigger("showpanel");
    }
  }
  function setup_header(ret) {
    if (ret.user) {
      var gist_uid = ret.user.id;
      $("#inlet-author").text(ret.user.login);
      $("#inlet-title").text(ret.gist.description);
      $("#avatar").attr("src", function(d) {
        return "http://2.gravatar.com/avatar/" + ret.user.gravatar_id;
      });
      d3.select("title").text("Tributary | " + ret.gist.description || "Tributary");
      if (ret.user.id !== tributary.userid) {
        $("#fork").css("display", "none");
        ret.config.saveType = "fork";
      } else {
        $("#fork").css("display", "");
      }
    } else {
      if (isNaN(tributary.userid) || !ret.gist) {
        $("#fork").css("display", "none");
        ret.config.saveType = "fork";
      }
    }
    setup_save(ret.config);
    $("#gist-title").on("keyup", function() {
      ret.config.set("description", $("#gist-title").val());
      d3.select("title").text($("#gist-title").val());
    });
  }
  function setup_save(config) {
    $("#save").off("click");
    $("#save").on("click", function(e) {
      console.log("saving!");
      d3.select("#syncing").style("display", "block");
      tributary.save_gist(config, config.saveType, function(newurl, newgist) {
        d3.select("#syncing").style("display", "none");
        if (config.saveType === "fork") {
          window.onunload = false;
          window.onbeforeunload = false;
          window.location = newurl;
        }
      });
    });
    $("#fork").off("click");
    $("#fork").on("click", function(e) {
      console.log("forking!");
      d3.select("#syncing").style("display", "block");
      tributary.save_gist(config, config.saveType, function(newurl, newgist) {
        window.onunload = false;
        window.onbeforeunload = false;
        window.location = newurl;
      });
    });
    $("#loginPanel").on("click", function(e) {
      tributary.login_gist(tributary.loggedin, function(newurl, newgist) {
        window.onunload = false;
        window.onbeforeunload = false;
        window.location = newurl;
      });
    });
  }
  return tributary;
};