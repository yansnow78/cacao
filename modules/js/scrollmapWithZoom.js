/* Scrollmap: a scrollable map */

define([
    "dojo", "dojo/_base/declare"
],
    function (dojo, declare) {
        return declare("ebg.scrollmapWithZoom", null, {
            constructor: function () {
                this.container_div = null;
                this.scrollable_div = null;
                this.surface_div = null;
                this.onsurface_div = null;
                this.isdragging = false;
                this.board_x = 0;
                this.board_y = 0;
                this.zoom = 1;
                this.prevZoom = 1;
                this.bEnableScrolling = true;
                this.zoomPinchDelta = 0.005;
                this.zoomWheelDelta = 0.001;
                this.bEnableZooming = false;
                this.zoomChangeHandler = null;
                this.bScrollDeltaAlignWithZoom = true;
                this.scrollDelta = false;
                this.pointers = [];
                this.resizeObserver = new ResizeObserver(this.onResize.bind(this));
            },
            create: function (container_div, scrollable_div, surface_div, onsurface_div) {
                this.container_div = container_div;
                this.scrollable_div = scrollable_div;
                this.surface_div = surface_div;
                this.onsurface_div = onsurface_div;
                dojo.connect(this.surface_div, 'onpointerdown', this, 'onPointerDown');
                dojo.connect(this.container_div, 'onwheel', this, 'onWheel');

                this.scrollto(0, 0);
                this.setMapZoom(this.zoom);
                this.resizeObserver.observe(this.container_div);
            },
            onResize: function (entries) {
                this.scrollto(this.board_x,this.board_y, 0, 0);
                //console.log("onResize");
            },
            findPointerIndex: function (event) {
                let i = this.pointers.length
                while (i--) {
                    if (this.pointers[i].pointerId === event.pointerId) {
                        return i
                    }
                }
                return -1
            },
            addPointer: function (event) {
                const i = this.findPointerIndex(event)
                // Update if already present
                if (i > -1) {
                    var prevEv=this.pointers[i];
                    this.pointers.splice(i, 1, event);
                    return prevEv; 
                } else
                    this.pointers.push(event)
            },
            removePointer: function (event) {
                const i = this.findPointerIndex(event)
                if (i > -1) {
                    this.pointers.splice(i, 1)
                }
            },
            getPointerPrevEvent: function (event) {
                const i = this.findPointerIndex(event)
                if (i > -1) {
                    return this.pointers[i]
                }
            },
            getXYCoord: function (ev, ev2) {
                var width = dojo.style(this.container_div, "width");
                var height = dojo.style(this.container_div, "height");
                var containerRect=this.container_div.getBoundingClientRect();
                // var scale = (containerRect.right-containerRect.left) / this.container_div.offsetWidth;
                // var scale2 = width / this.container_div.offsetWidth;
                // console.log(scale, scale2);
                var clientX=ev.clientX;
                var clientY=ev.clientY;
                if (typeof ev2 !== 'undefined'){
                    clientX=(clientX+ev2.clientX)/2;
                    clientY=(clientY+ev2.clientY)/2;
                }

                // if ( /chrome/i.test( navigator.userAgent ) ) {
                //     // In Chrome zoom of a parent node requires to adjust mouseX/mouseY
                //     var parent = this.container_div.parentNode;
                //     while ( parent.parentNode != null ) {
                //         if ( parent.style.zoom && parent.style.zoom != 1 ) {
                //             clientX /= parent.style.zoom;
                //             clientY /= parent.style.zoom;
                //             break;
                //         }
                //         parent = parent.parentNode;
                //     }
                // }
                
                // console.log(clientX,clientY);
                // console.log(ev.pageX,ev.pageY);
                var x=clientX-containerRect.x-width/2;
                var y=clientY-containerRect.y-height/2;
                return [x,y];
            },
            startDragging: function (ev) {
                if (!this.bEnableScrolling)
                    return;

                this.isdragging = true;
                this.pointer_startX = ev.pageX;
                this.pointer_startY = ev.pageY;
            },
            onPointerDown: function (ev) {
                // console.log(ev.pageX+' '+ev.pageY);
                if (!this.bEnableScrolling && !this.bEnableZooming)
                    return;
                if (this.pointers.length == 0) {
                    this.onpointermove_handler = dojo.connect(document, "onpointermove", this, "onPointerMove");
                    this.onpointerup_handler = dojo.connect(document, "onpointerup", this, "onPointerUp");
                    this.onpointercancel_handler = dojo.connect(document, "onpointercancel", this, "onPointerUp");
                    //this.startDragging(ev);
                } else
                    this.isdragging = false;
                this.addPointer(ev);
            },
            onPointerMove: function (ev) {
                ev.preventDefault();
                //var prevEv = this.getPointerPrevEvent(ev);
                var prevEv =  this.addPointer(ev);

                // If one pointer is move, drag the map
                if (this.pointers.length === 1) {
                    if (!this.bEnableScrolling)
                        return;
                    if ((typeof prevEv !== 'undefined')) {
                        // console.log(prevEv.pageX+' '+prevEv.pageY);
                        //this.scroll(ev.pageX - this.pointer_startX, ev.pageY - this.pointer_startY, 0, 0)
                        var [x,y] = this.getXYCoord(ev);
                        var [xPrev,yPrev] = this.getXYCoord(prevEv);
                        this.scroll(x  - xPrev , y - yPrev, 0, 0)
                        //this.scroll(ev.screenX  - prevEv.screenX , ev.screenY - prevEv.screenY, 0, 0)
                    }
                    //this.startDragging(ev);
                }
                // If two pointers are move, check for pinch gestures
                else if (this.pointers.length === 2) {
                    if (!this.bEnableZooming)
                        return;

                    this.isdragging = 0;

                    // Calculate the distance between the two pointers
                    const event1 = this.pointers[0];
                    const event2 = this.pointers[1];
                    const curDist = Math.sqrt(
                        Math.pow(Math.abs(event2.clientX - event1.clientX), 2) +
                        Math.pow(Math.abs(event2.clientY - event1.clientY), 2)
                    );
                    var [x,y] = this.getXYCoord(event1, event2);
                    if (this.prevDist > 0.0) {
                        const diff = curDist - this.prevDist;
                        // newZoom = this.zoom * (1 + this.zoomPinchDelta * diff);
                        newZoom = this.zoom * (curDist / this.prevDist);
                        this.setMapZoom(newZoom, x, y);
                        this.scroll(x  - this.xPrev , y - this.yPrev, 0, 0)
                    }

                    // Cache the distance for the next move event
                    this.prevDist = curDist;
                    this.xPrev = x;
                    this.yPrev = y;
                }
                dojo.stopEvent(ev);
            },
            onPointerUp: function (ev) {
                this.removePointer(ev);
                // If no pointer left, stop drag or zoom the map
                if (this.pointers.length === 0) {
                    this.isdragging = 0;
                    dojo.disconnect(this.onpointermove_handler);
                    dojo.disconnect(this.onpointerup_handler);
                    dojo.disconnect(this.onpointercancel_handler);
                }

                // If the number of pointers down is less than two then reset diff tracker
                if (this.pointers.length < 2) {
                    this.prevDist = -1;
                }
            },
            onWheel: function (evt) {
                if (!this.bEnableZooming)
                    return;
                evt.preventDefault();
                var [x,y]=this.getXYCoord(evt);
                this.changeMapZoom(evt.deltaY * -this.zoomWheelDelta, x, y);
            },

            scroll: function (dx, dy, duration, delay) {
                if (typeof duration == 'undefined') {
                    duration = 350; // Default duration
                }
                if (typeof delay == 'undefined') {
                    delay = 0; // Default delay
                }
                //console.log(dx+' '+dy);
                this.scrollto(this.board_x + dx, this.board_y + dy, duration, delay);
            },

            // Scroll the board to make it centered on given position
            scrollto: function (x, y, duration, delay) {
                if (typeof duration == 'undefined') {
                    duration = 350; // Default duration
                }
                if (typeof delay == 'undefined') {
                    delay = 0; // Default delay
                }

                var width = dojo.style(this.container_div, "width");
                var height = dojo.style(this.container_div, "height");

                var board_x = toint(x + width / 2);
                var board_y = toint(y + height / 2);

                this.board_x = x;
                this.board_y = y;

                if ((duration == 0) && (delay == 0)) {
                    dojo.style(this.scrollable_div, "left", board_x + "px");
                    dojo.style(this.onsurface_div, "left", board_x + "px");
                    dojo.style(this.scrollable_div, "top", board_y + "px");
                    dojo.style(this.onsurface_div, "top", board_y + "px");
                    // dojo.style( dojo.body(), "backgroundPosition", x+"px "+y+"px" );
                    return;
                }

                var anim = dojo.fx.combine([
                    dojo.fx.slideTo({
                        node: this.scrollable_div,
                        top: board_y,
                        left: board_x,
                        unit: "px",
                        duration: duration,
                        delay: delay
                    }),
                    dojo.fx.slideTo({
                        node: this.onsurface_div,
                        top: board_y,
                        left: board_x,
                        unit: "px",
                        duration: duration,
                        delay: delay
                    })
                ]);

                anim.play();
            },

            // Scroll map in order to center everything
            // By default, take all elements in movable_scrollmap
            //  you can also specify (optional) a custom CSS query to get all concerned DOM elements
            scrollToCenter: function (custom_css_query) {
                // Get all elements inside and get their max x/y/w/h
                var max_x = 0;
                var max_y = 0;
                var min_x = 0;
                var min_y = 0;

                var css_query = '#' + this.scrollable_div.id + " > *";
                if (typeof custom_css_query != 'undefined') {
                    css_query = custom_css_query;
                }

                dojo.query(css_query).forEach(dojo.hitch(this, function (node) {
                    max_x = Math.max(max_x, dojo.style(node, 'left') + dojo.style(node, 'width'));
                    min_x = Math.min(min_x, dojo.style(node, 'left'));

                    max_y = Math.max(max_y, dojo.style(node, 'top') + dojo.style(node, 'height'));
                    min_y = Math.min(min_y, dojo.style(node, 'top'));
                }));
                this.scrollto(-(min_x + max_x) / 2, -(min_y + max_y) / 2);
            },

            getMapCenter: function (custom_css_query) {
                // Get all elements inside and get their max x/y/w/h
                var max_x = 0;
                var max_y = 0;
                var min_x = 0;
                var min_y = 0;

                var css_query = '#' + this.scrollable_div.id + " > *";
                if (typeof custom_css_query != 'undefined') {
                    css_query = custom_css_query;
                }

                dojo.query(css_query).forEach(dojo.hitch(this, function (node) {
                    max_x = Math.max(max_x, dojo.style(node, 'left') + dojo.style(node, 'width'));
                    min_x = Math.min(min_x, dojo.style(node, 'left'));

                    max_y = Math.max(max_y, dojo.style(node, 'top') + dojo.style(node, 'height'));
                    min_y = Math.min(min_y, dojo.style(node, 'top'));

                    //                alert( node.id );
                    //                alert( min_x+','+min_y+' => '+max_x+','+max_y );
                }));

                return {
                    x: (min_x + max_x) / 2,
                    y: (min_y + max_y) / 2
                };
            },

            changeMapZoom: function (diff, x=0, y=0) {
                var newZoom = this.zoom + diff;
                this.setMapZoom(newZoom,x,y);
            },

            setMapZoom: function (zoom, x=0, y=0) {
                this.zoom = Math.min(Math.max(zoom, 0.2), 2);
                if (this.bScrollDeltaAlignWithZoom)
                    this.scrollDeltaAlignWithZoom = this.scrollDelta * zoom;
                else
                    this.scrollDeltaAlignWithZoom = this.scrollDelta;
                this.setScale(this.scrollable_div, this.zoom);
                this.setScale(this.onsurface_div, this.zoom);
                if (this.zoomChangeHandler)
                    this.zoomChangeHandler(this.zoom);
                var zoomDelta = this.zoom/this.prevZoom;
                //console.log(x+' '+ y+' '+ zoomDelta+' '+ this.zoom);
                this.scrollto((this.board_x*zoomDelta) +x*(1-zoomDelta) , (this.board_y*zoomDelta)+y*(1-zoomDelta), 0, 0);
                this.prevZoom = this.zoom;
            },

            setScale: function (elemId, scale) {
                dojo.style($(elemId), 'transform', 'scale(' + scale + ')');
            },

            //////////////////////////////////////////////////
            //// Scroll with buttons

            // Optional: setup on screen arrows to scroll the board
            setupOnScreenArrows: function (scrollDelta) {
                this.scrollDelta = scrollDelta;
                if (this.bScrollDeltaAlignWithZoom)
                    this.scrollDeltaAlignWithZoom = scrollDelta * this.zoom;
                else
                    this.scrollDeltaAlignWithZoom = scrollDelta;

                // Old controls - for compatibility
                if ($('movetop')) {
                    dojo.connect($('movetop'), 'onclick', this, 'onMoveTop');
                }
                if ($('moveleft')) {
                    dojo.connect($('moveleft'), 'onclick', this, 'onMoveLeft');
                }
                if ($('moveright')) {
                    dojo.connect($('moveright'), 'onclick', this, 'onMoveRight');
                }
                if ($('movedown')) {
                    dojo.connect($('movedown'), 'onclick', this, 'onMoveDown');
                }

                // New controls
                dojo.query('#' + this.container_div.id + ' .movetop').connect('onclick', this, 'onMoveTop').style('cursor', 'pointer');
                dojo.query('#' + this.container_div.id + ' .movedown').connect('onclick', this, 'onMoveDown').style('cursor', 'pointer');
                dojo.query('#' + this.container_div.id + ' .moveleft').connect('onclick', this, 'onMoveLeft').style('cursor', 'pointer');
                dojo.query('#' + this.container_div.id + ' .moveright').connect('onclick', this, 'onMoveRight').style('cursor', 'pointer');

            },

            onMoveTop: function (evt) {
                console.log("onMoveTop");
                evt.preventDefault();
                this.scroll(0, this.scrollDeltaAlignWithZoom);
            },
            onMoveLeft: function (evt) {
                console.log("onMoveLeft");
                evt.preventDefault();
                this.scroll(this.scrollDeltaAlignWithZoom, 0);
            },
            onMoveRight: function (evt) {
                console.log("onMoveRight");
                evt.preventDefault();
                this.scroll(-this.scrollDeltaAlignWithZoom, 0);
            },
            onMoveDown: function (evt) {
                console.log("onMoveDown");
                evt.preventDefault();
                this.scroll(0, -this.scrollDeltaAlignWithZoom);
            },

            isVisible: function (x, y) {
                var width = dojo.style(this.container_div, "width");
                var height = dojo.style(this.container_div, "height");

                if (x >= (-this.board_x - width / 2) && x <= (-this.board_x + width / 2)) {
                    if (y >= (-this.board_y - height / 2) && y < (-this.board_y + height / 2)) {
                        return true;
                    }
                }

                return false;
            },

            ///////////////////////////////////////////////////
            ///// Enable / disable scrolling
            enableScrolling: function () {
                if (!this.bEnableScrolling) {
                    this.bEnableScrolling = true;

                    dojo.query('#' + this.container_div.id + ' .movetop').style('display', 'block');
                    dojo.query('#' + this.container_div.id + ' .moveleft').style('display', 'block');
                    dojo.query('#' + this.container_div.id + ' .moveright').style('display', 'block');
                    dojo.query('#' + this.container_div.id + ' .movedown').style('display', 'block');

                }
            },
            disableScrolling: function () {
                if (this.bEnableScrolling) {
                    this.bEnableScrolling = false;

                    // hide arrows

                    dojo.query('#' + this.container_div.id + ' .movetop').style('display', 'none');
                    dojo.query('#' + this.container_div.id + ' .moveleft').style('display', 'none');
                    dojo.query('#' + this.container_div.id + ' .moveright').style('display', 'none');
                    dojo.query('#' + this.container_div.id + ' .movedown').style('display', 'none');

                }

            },

            //////////////////////////////////////////////////
            //// Zoom with buttons
            setupOnScreenZoomButtons: function (zoomDelta) {
                this.zoomDelta = zoomDelta;

                // Old controls - for compatibility
                if ($('zoomin')) {
                    dojo.connect($('zoomin'), 'onclick', this, 'onZoomIn');
                }
                if ($('zoomout')) {
                    dojo.connect($('zoomout'), 'onclick', this, 'onZoomOut');
                }

                // New controls
                dojo.query('#' + this.container_div.id + ' .zoomin').connect('onclick', this, 'onZoomIn').style('cursor', 'pointer');
                dojo.query('#' + this.container_div.id + ' .zoomout').connect('onclick', this, 'onZoomOut').style('cursor', 'pointer');

            },
            onZoomIn: function (evt) {
                evt.preventDefault();
                this.changeMapZoom(this.zoomDelta);
            },
            onZoomOut: function (evt) {
                evt.preventDefault();
                this.changeMapZoom(-this.zoomDelta);
            },
        });
    });