(function() {

    tributary.clear = function() {
        //var sw = parseInt(d3.select("#display").style("width"));
        //var sh = parseInt(d3.select("#display").style("height"));
        tributary.canvas.width = tributary.sw;
        tributary.canvas.height = tributary.sh;
        tributary.ctx.clearRect(0, 0, tributary.sw, tributary.sh);

    }
    tributary.Cypress = tributary.Tributary.extend({
        //For exploring animations, run loops 
        initialize: function() {
            this.binder();
            this.set({
                code: '\
tributary.init = function(ctx) {\n\
};\n\
tributary.run = function(ctx,t) {\n\
    tributary.clear(); //helper function to clear the canvas \n\
};'
            });
        },
        execute: function() {
            var js = this.handle_coffee();
            try {
                eval(js);
                this.trigger("noerror");
            } catch (e) {
                this.trigger("error", e);
            }

            try {
                tributary.clear();
                //we exec the user defined append code
                tributary.init(tributary.ctx);
                //then we run the user defined run function
                tributary.execute();
                this.trigger("noerror");
            } catch (er) {
                this.trigger("error", er);
            }

            return true;
        }
    });
    //time slider
    //window.delta = {}
    //var delta = window.delta;
    //we will keep track of our t parameter for the user
    tributary.t = 0.0;  
    tributary.dt = 0.01; //make steps of 0.01
    //use this to control playback
    tributary.pause = true;

    //d3.select("#pingpong_button").style("background-color", "#e3e3e3")
    $("#"+tributary.loop+"_button").addClass("selected-button");


    //default easing function
    tributary.ease = d3.ease("linear");
    
    //tributary.g = d3.select("#cypresssvg").append("g").attr("id", "cypress");
    tributary.canvas = d3.select("#cypresscanvas").node();
    tributary.ctx = tributary.canvas.getContext('2d');

    //user is responsible for defining this
    //by default we just show simple text
    tributary.run = function(g,t,i) {
    };


    //this is a wrapper 
    tributary.execute = function() {
        try {
            //tributary.run(tributary.ease(tributary.t), tributary.g, 0)
            tributary.run(tributary.ctx, tributary.t, 0);
        } catch (e) {}
    };

    /*
    var pause = false;
    d3.timer(function() {
        if(pause) return false;
    })
    */

    //we need to save state of timer so when we pause/unpause or manually change slider
    //we can finish a transition
    tributary.timer = {
        then: new Date(),
        ctime: tributary.t
    };


    var play_button = $("#play_button");
    play_button.on("click", function(event) {
        if($("#play_button").hasClass("playing")){
                $("#play_button").removeClass("playing");
                play_button.text("Play");
        }
        else if(!$("#play_button").hasClass("playing")){
            play_button.addClass("playing");
            play_button.text("Stop");
            
        }
        
        tributary.pause = !tributary.pause;
//        play_button.addClass("playing");
        
        if(!tributary.pause) {
            //unpausing, so we setup our timer to run
            tributary.timer.then = new Date();
            tributary.timer.ctime = tributary.t;
        }
    });


    d3.timer(function() {
        //if paused lets not execute
        if(tributary.pause) { return false; }

        //var now = new Date();
        //var dtime = now - tributary.timer.then;
        //tributary.t = tributary.timer.ctime + dtime;
        tributary.t += tributary.dt;

        tributary.execute();
        /*
        try {
            tributary.run(tributary.t)
        } catch (e) {}
        */
    });


}());



