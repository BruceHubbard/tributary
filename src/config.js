
//The config model is the glue that binds together a particular configurtion
//of tributary components
tributary.Config = Backbone.Model.extend({
  defaults: {
      description: "Tributary inlet",
      endpoint: "tributary",
      display: "svg",
      public: true,
      require: [], //require modules will be like : {name:"crossfilter", url:"/static/lib/crossfilter.min.js"}
      fileconfigs: {}, //per-file configurations (editor specific)

      //things related to time control
      play: false,
      loop: false,
      restart: false,
      //time options
      autoinit: true,
      pause: true,
      loop_type: "period", //["off", "period", "pingpong"]
      bv: false,
      nclones: 15,
      clone_opacity: 0.4,
      duration: 3000,
      ease: "linear",
      dt: 0.01

  },

  require: function(callback) {
    //load scripts from the require array with require.js
    var modules = this.get("require");
    var scripts = _.pluck(modules, "url");

    //NOTE: require.js  does not give us a real callback, in the sense that if things fail
    //it doesn't callback with an error. not sure how to detect script failure... 
    var rcb = function() {
      return callback(null, arguments);
    };
    require(scripts, rcb);
  },

  initialize: function() {
    //convenience event to trigger a hide event on all contexts (and thus their editors)
    this.on("hide", function() {
      this.contexts.forEach(function(context) {
        context.model.trigger("hide");
      });
    }, this);
  }
});

////////////////////////////////////////////////////////////////////////
// Config UI
////////////////////////////////////////////////////////////////////////
tributary.ConfigView = Backbone.View.extend({
  initialize: function() {

  },

  render: function() {
    //TODO: split each of the sections into their own view?
    //at least the require stuff probably
    var that = this;

    var reader = new FileReader();

    //thumbnail code
    function handleFileSelect() {
      var files = d3.event.target.files; // FileList object
      // files is a FileList of File objects. 
      for (var i = 0, f; f = files[i]; i++) {
        //console.log("file", f);
        //get file data and send it to imgur

        // Only process image files.
        if (!f.type.match('image.*')) {
          console.log("not an image")
          continue;
        }

        // Closure to capture the file information.
        reader.onload = (function(f) {
          return function(e) {
            // Render thumbnail.
            //e.target.result
            var len = "data:image/png;base64,".length;
            var img = e.target.result.substring(len);

            console.log("upload!")
            $.post("/imgur/upload/thumbnail", {"image":img}, function(image) {
              console.log("response", image);
              if(image.status === 200) {
                //we have successful upload!
                d3.select("#trib-thumbnail").attr("src", image.data.link);
                d3.select("#trib-thumbnail").style("display", "");

                that.model.set("thumbnail", image.data.link);

              } else {
                //oops
              }
            })
          };
        })(f);

        // Read in the image file as a data URL.
        reader.readAsDataURL(f);
      }
    }
    d3.select("#thumbnail-content").select("input").on("change", handleFileSelect);
    var link = this.model.get("thumbnail");
    if(link) {
      d3.select("#thumbnail-content").select("img")
        .attr("src", link)
        .style("display", "");
    }
    var displaySelect = d3.select(this.el).select("#config-content select")
      .on("change", function() {
        var display = this.selectedOptions[0].value;
        that.model.set("display", display);
        tributary.events.trigger("execute");
      })

    var currentDisplay = this.model.get("display");
    displaySelect.selectAll("option")
      .each(function(d,i) {
        if(this.value === currentDisplay) {
          //d3.select(this).attr("selected", "selected")
         displaySelect.node().value= this.value;
        }
      })
    
    var timecontrols = d3.select("#timecontrols")
      .selectAll("button");

    timecontrols.datum(function() { return this.dataset; })
    timecontrols.filter(function(d) {
      return that.model.get(d.name);
    })
    .classed("active", true);

    timecontrols.on("click", function(d) {
      var tf = !that.model.get(d.name);
      d3.select(this).classed("active", tf);
      that.model.set(d.name, tf);
    });


    // Editor controls config section

    var editorcontrols = d3.select(this.el)
      .select("#logerrors")
      .on("click", function(d) {
        var dis = d3.select(this);
        if($(this).attr("data-name") === "log-errors") {
          //if (tributary.hint === true && tributary.trace === true) {
          if( dis.classed("active") ) {
            console.log("Error logging disabled");
            tributary.hint = false;
            tributary.trace = false;
            tributary.events.trigger("execute");
            dis.classed("active", false)
          }
          else {
            console.log("Error logging initiated");
            tributary.hint = true;
            tributary.trace = true;
            tributary.events.trigger("execute");
            dis.classed("active", true)
          }
        }
      })

    // Require / External files config section
    var checkList = d3.select(this.el)
      .select("#library-checklist");
    var libLinks= d3.select(this.el)
      .select("#library-links");

    var name_input = libLinks
      .select("input.library-title");
    var url_input = libLinks
      .select("input.library-url");

    function addReq() {
      //create a new checkbox with the data for the require
      var req = {
        name: name_input.node().value,
        url: url_input.node().value
      };
      var reqs = that.model.get("require");
      reqs.push(req);
      that.model.require(function(err, res) {});
      that.model.set("require", reqs);
      createLibCheckbox(checkList.selectAll("li.lib").data(reqs).enter());
    }

    var add = libLinks.select(".add-library")
      .on("click", addReq)

    name_input.on("keypress", function() {
      //they hit enter
      if(d3.event.charCode === 13) {
        addReq();
      }
    });
    url_input.on("keypress", function() {
      //they hit enter
      if(d3.event.charCode === 13) {
        addReq();
      }
    });

    function createLibCheckbox(selection) {
      var li = selection.append("li")
        .classed("lib", true)
      li.append("input")
        .attr("type", "checkbox")
        .attr("checked", true) 
        .on("change", function(d) {
          var reqs = that.model.get("require");
          var ind = reqs.indexOf(d);
          if(ind >= 0) {
            reqs.splice(ind, 1);
            that.model.set("require", reqs);
          } else {
            reqs.push(d);
            that.model.set("require", reqs);
          }
        })
      li.append("span").text(function(d) {
        return d.name;
      })

    }

    var newCheckboxes = checkList.selectAll("li.lib")
      .data(this.model.get("require"))
      .enter()

    createLibCheckbox(newCheckboxes);
  }
});

