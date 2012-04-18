$(function() {

    //time slider
    //window.delta = {}
    //var delta = window.delta;
    //we will keep track of our t parameter for the user
    tributary.t = 0.01  //start at .01 so we don't trigger a flip at the start
    //use this to control playback
    tributary.pause = true
    //default loop mode
    //tributary.loop = "off";
    //tributary.loop = "period";
    tributary.loop = "pingpong";
    //d3.select("#pingpong_button").style("background-color", "#e3e3e3")
    $("#"+tributary.loop+"_button").addClass("selected-button")

    tributary.reverse = false;

    //TODO: expose these with dat.GUI (especially for the easing functions)
    //default duration for playback
    tributary.duration = 3000;


    //default easing function
    tributary.ease = d3.ease("linear")

    //default opacity for clones
    tributary.clone_opacity = 0.4;


    //default number of clones to use for BV mode
    tributary.nclones = 10;

    tributary.clones = d3.select("svg").append("g").attr("id", "clones")
    tributary.g = d3.select("svg").append("g").attr("id", "delta")

    //user is responsible for defining this
    //by default we just show simple text
    tributary.run = function(t, g) {
        
        //$('svg').empty();
        $('#delta').empty();
        g.append("text")
            .text("t: " + t)
            .attr("font-size", 60)
            .attr("dy", "1em");
    }


    //this is a wrapper 
    tributary.execute = function(g) {
        try {
            tributary.run(tributary.ease(tributary.t), g)
        } catch (e) {}
    }

    /*
    var pause = false;
    d3.timer(function() {
        if(pause) return false;
    })
    */



    // create delta's time slider
    var time_slider = $('#time_slider');
    time_slider.slider({
        slide: function(event, ui) {
            //console.log("ui.value", ui.value);
            //set the current t to the slider's value
            tributary.t = ui.value
            //call the run function with the current t
            tributary.execute(tributary.g)
        /*
            try {
                tributary.run(tributary.t)
            } catch (e) {}
            */
        },
        min: 0,
        max: 1,
        step: .01,
        value: tributary.t
    });

    //we need to save state of timer so when we pause/unpause or manually change slider
    //we can finish a transition
    tributary.timer = {
        then: new Date(),
        duration: tributary.duration,
        ctime: tributary.t
    }

    var play_button = $("#play_button")
    play_button.on("click", function(event) {
        if($("#play_button").hasClass("playing")){
                $("#play_button").removeClass("playing");
                play_button.text("Play")
        }
        else if(!$("#play_button").hasClass("playing")){
            play_button.addClass("playing")
            play_button.text("Stop")
            
        }

        
        if(tributary.t < 1) {
            tributary.pause = !tributary.pause;
    //        play_button.addClass("playing");
            
            if(!tributary.pause) {
                //unpausing, so we setup our timer to run
                tributary.timer.then = new Date();
                tributary.timer.duration = (1 - tributary.t) * tributary.duration
                tributary.timer.ctime = tributary.t
            }
        }
    })
     $("#off_button").on("click", function(event) {
        tributary.loop = "off"
         d3.selectAll(".select").style("background-color", null)
          $('.select').removeClass("selected-button");
          $("#play_button").removeClass("playing");
         $("#off_button").addClass("selected-button")
    })
     
    $("#loop_button").on("click", function(event) {
        tributary.loop = "period"
         d3.selectAll(".select").style("background-color", null)
         $('.select').removeClass("selected-button");
         $("#loop_button").addClass("selected-button")
    })
     $("#pingpong_button").on("click", function(event) {
        tributary.loop = "pingpong"
         d3.selectAll(".select").style("background-color", null)
          $('.select').removeClass("selected-button");
         $("#pingpong_button").addClass("selected-button")
    })
     
    var make_clones = function() {
        //make n frames with lowered opacity
        var svg = d3.select("#clones")
        var frames = d3.range(tributary.nclones)
        var gf = svg.selectAll("g.bvclone")
            .data(frames).enter()
            .append("g")
                .attr("class", "bvclone")
                .style("opacity", tributary.clone_opacity)

        gf.each(function(d, i) {
            var frame = d3.select(this)
            tributary.append(frame)
            tributary.run(i/tributary.nclones, frame)
        })
        console.log("clones made")
    }

    tributary.bv = false;
    $("#bv_button").on("click", function(event) {
        tributary.bv = !tributary.bv;
        if(tributary.bv)
        {
            d3.select("#bv_button").style("background-color", "#e3e3e3")
            make_clones();
        }
        else
        {
            d3.select("#bv_button").style("background-color", null)
            d3.selectAll(".bvclone").remove()
        }
    })



    d3.timer(function() {
        //if paused lets not execute
        if(tributary.pause) return false;

        var now = new Date();
        var dtime = now - tributary.timer.then;
        if (tributary.reverse) {
            var dt = tributary.timer.ctime * dtime / tributary.timer.duration * -1;
        }
        else {
            var dt = (1 - tributary.timer.ctime) * dtime / tributary.timer.duration;
        }
        tributary.t = tributary.timer.ctime + dt;
        

        //once we reach 1, lets pause and stay there
        if(tributary.t >= 1 || tributary.t <= 0 || tributary.t === "NaN")
        {
            if(tributary.loop === "period") {
                tributary.t = 0;
                tributary.timer.then = new Date();
                tributary.timer.duration = tributary.duration;
                tributary.timer.ctime = tributary.t;
                tributary.reverse = false;
                //tributary.pause = false;
            } else if (tributary.loop === "pingpong") {
                //this sets tributary.t to 0 when we get to 0 and 1 when we get to 1 (because of the direction we were going)
                tributary.t = !tributary.reverse
                tributary.timer.then = new Date();
                tributary.timer.duration = tributary.duration;
                tributary.timer.ctime = tributary.t;
                tributary.reverse = !tributary.reverse;
            }
            else {
                if (tributary.t != 0)
                {
                    tributary.t = 1;
                    tributary.pause = true;
                }
            }
        }
        
        //move the slider
        time_slider.slider('option', 'value', tributary.t);
        //update the function (there is probably a way to have the slider's
        //function get called programmatically)
        tributary.execute(tributary.g)
        /*
        try {
            tributary.run(tributary.t)
        } catch (e) {}
        */
    })



})



