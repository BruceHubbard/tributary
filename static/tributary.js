(function() {
  var tributary = {};
  window.tributary = tributary;
  tributary.events = _.clone(Backbone.Events);
  tributary.data = {};
  window.trib = {};
  window.trib_options = {};
  window.addEventListener("resize", function(event) {
    tributary.events.trigger("resize", event);
  });
  tributary.CodeModel = Backbone.Model.extend({
    defaults: {
      code: "",
      filename: "inlet.js",
      name: "inlet",
      type: "js",
      config: {
        coffee: false,
        vim: false,
        emacs: false,
        hide: false
      }
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
      if (this.get("config").coffee) {
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
      endpoint: "tributary",
      "public": true,
      require: []
    },
    require: function(callback, ret) {
      var modules = this.get("require");
      var scripts = _.pluck(modules, "url");
      var rcb = function() {
        return callback(ret, arguments);
      };
      require(scripts, rcb);
    }
  });
  tributary.ConfigView = Backbone.View.extend({
    render: function() {}
  });
  tributary.Context = Backbone.View.extend({
    initialize: function() {},
    execute: function() {},
    render: function() {}
  });
  tributary.TributaryContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("change:code", this.execute, this);
    },
    execute: function() {
      var js = this.model.handle_coffee();
      var that = this;
      try {
        tributary.initialize = new Function("g", js);
      } catch (e) {
        this.trigger("error", e);
        return false;
      }
      try {
        window.trib = {};
        window.trib_options = {};
        trib = window.trib;
        trib_options = window.trib_options;
        $(this.el).children("svg").empty();
        tributary.initialize(this.svg);
      } catch (er) {
        this.model.trigger("error", er);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {
      this.svg = d3.select(this.el).append("svg").attr({
        xmlns: "http://www.w3.org/2000/svg",
        xlink: "http://www.w3.org/1999/xlink",
        "class": "tributary_svg"
      });
    }
  });
  tributary.JSONContext = tributary.Context.extend({
    initialize: function() {
      this.model.on("code", this.execute, this);
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
  tributary.DeltaContext = Backbone.View.extend({
    initialize: function() {
      this.model.on("change:code", this.execute, this);
      this.pause = true;
      this.reverse = false;
      this.loop = "period";
      this.bv = false;
      this.nclones = 15;
      this.clonse_opacity = .4;
      this.duration = 3e3;
      this.t = 0;
      this.ease = d3.ease("linear");
      tributary.init = function(g, t, i) {};
      tributary.run = function(g, t, i) {};
      var that = this;
      that.timer = {
        then: new Date,
        duration: that.duration,
        ctime: that.t
      };
      d3.timer(function() {
        if (that.pause) {
          return false;
        }
        var now = new Date;
        var dtime = now - that.timer.then;
        var dt;
        if (that.reverse) {
          dt = that.timer.ctime * dtime / that.timer.duration * -1;
        } else {
          dt = (1 - that.timer.ctime) * dtime / that.timer.duration;
        }
        that.t = that.timer.ctime + dt;
        if (that.t >= 1 || that.t <= 0 || that.t === "NaN") {
          if (that.loop === "period") {
            that.t = 0;
            that.timer.then = new Date;
            that.timer.duration = that.duration;
            that.timer.ctime = that.t;
            that.reverse = false;
          } else if (that.loop === "pingpong") {
            that.t = !that.reverse;
            that.timer.then = new Date;
            that.timer.duration = that.duration;
            that.timer.ctime = that.t;
            that.reverse = !that.reverse;
          } else {
            if (that.t !== 0) {
              that.t = 1;
              that.pause = true;
            }
          }
        }
        if (that.t === true) {
          that.t = 1;
        }
        if (that.t === false) {
          that.t = 0;
        }
        $("#slider").attr("value", that.t);
        tributary.run(that.g, that.ease(that.t), 0);
      });
    },
    execute: function() {
      var js = this.model.handle_coffee();
      try {
        tributary.initialize = new Function("g", js);
        tributary.initialize();
      } catch (e) {
        this.model.trigger("error", e);
        return false;
      }
      if (tributary.bv) {
        try {
          $(this.clones.node()).empty();
          this.make_clones();
        } catch (er) {
          this.model.trigger("error", er);
        }
      }
      try {
        window.trib = {};
        window.trib_options = {};
        trib = window.trib;
        trib_options = window.trib_options;
        $(this.g.node()).empty();
        tributary.init(this.g, 0);
        tributary.run(this.g, this.ease(this.t), 0);
      } catch (err) {
        this.model.trigger("error", err);
        return false;
      }
      this.model.trigger("noerror");
      return true;
    },
    render: function() {
      this.svg = d3.select(this.el).append("svg").attr({
        xmlns: "http://www.w3.org/2000/svg",
        xlink: "http://www.w3.org/1999/xlink",
        "class": "tributary_svg"
      });
      this.clones = this.svg.append("g").attr("id", "clones");
      this.g = this.svg.append("g").attr("id", "delta");
    },
    make_clones: function() {
      var frames = d3.range(this.nclones);
      var gf = this.clones.selectAll("g.bvclone").data(frames).enter().append("g").attr("class", "bvclone").style("opacity", this.clone_opacity);
      gf.each(function(d, i) {
        var j = i + 1;
        var frame = d3.select(this);
        tributary.init(frame, j);
        var t = this.ease(j / (this.nclones + 1));
        tributary.run(frame, t, j);
      });
    }
  });
  tributary.Editor = Backbone.View.extend({
    initialize: function() {
      this.config = this.model.get("config");
    },
    render: function() {
      var that = this;
      d3.select(this.el).attr({
        "class": "editor"
      });
      this.cm = CodeMirror(this.el, {
        mode: "javascript",
        theme: "lesser-dark",
        lineNumbers: true,
        onChange: function() {
          var code = that.cm.getValue();
          that.model.set("code", code);
        }
      });
      this.cm.setValue(this.model.get("code"));
      this.inlet = Inlet(this.cm);
      this.model.on("error", function() {
        d3.select(that.el).select(".CodeMirror-gutter").style({
          "border-right": "2px solid red"
        });
      });
      this.model.on("noerror", function() {
        d3.select(that.el).select(".CodeMirror-gutter").style({
          "border-right": "1px solid #aaa"
        });
      });
    }
  });
  tributary.gist = function(id, callback) {
    var ret = {};
    var cachebust = "?cachebust=" + Math.random() * 0xf12765df4c9b2;
    d3.json("https://api.github.com/gists/" + id + cachebust, function(data) {
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
      });
      ret.config.require(callback, ret);
    });
  };
  tributary.FilesView = Backbone.View.extend({
    initialize: function() {},
    render: function() {}
  });
  tributary.ControlsView = Backbone.View.extend({
    initialize: function() {},
    render: function() {}
  });
  tributary.context_map = {
    tributary: tributary.TributaryContext,
    delta: tributary.DeltaContext,
    cypress: tributary.CypressContext
  };
})();