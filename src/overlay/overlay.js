/**
 * @license 
 * tools.overlay @VERSION - Overlay base. Extend it.
 * 
 * Copyright (c) 2010 Tero Piirainen
 * http://flowplayer.org/tools/overlay/
 *
 * Dual licensed under MIT and GPL 2+ licenses
 * http://www.opensource.org/licenses
 *
 * Since: March 2008
 * Date: @DATE 
 */
(function($) { 

	// static constructs
	$.tools = $.tools || {};
	
	$.tools.overlay = {
		
		version: '@VERSION',
		
		addEffect: function(name, loadFn, closeFn) {
			effects[name] = [loadFn, closeFn];	
		},
	
		conf: {  
			top: '10%', 
			left: 'center',
			absolute: false,
			
			speed: 'normal',
			closeSpeed: 'fast',
			effect: 'default',
			
			close: null,	
			oneInstance: true,
			closeOnClick: true,
			closeOnEsc: true,			
			mask: null,
			
			// target element to be overlayed. by default taken from [rel]
			target: null,
			api: false
		}
	};

	
	var instances = [], effects = {};
		
	// the default effect. nice and easy!
	$.tools.overlay.addEffect('default', 
		
		/* 
			onLoad/onClose functions must be called otherwise none of the 
			user supplied callback methods won't be called
		*/
		function(onLoad) { 
			this.getOverlay().fadeIn(this.getConf().speed, onLoad); 
			
		}, function(onClose) {
			this.getOverlay().fadeOut(this.getConf().closeSpeed, onClose); 			
		}		
	);		

	
	function Overlay(trigger, conf) {		
		
		// private variables
		var self = this, 
			 $self = $(this),
			 w = $(window), 
			 closers,
			 overlay,
			 opened,
			 mask = conf.mask && $.tools.mask.version;		
			 
		// @deprecated 
		if (conf.expose &&  $.tools.mask.version) {
			mask = conf.expose;	
		}
		
		// mask configuration
		if (mask) {			
			if (typeof mask == 'string') { mask = {color: mask}; }
			mask.closeOnClick = mask.closeOnEsc = false;
		}			
		
		// get overlay and triggerr
		var jq = conf.target || trigger.attr("rel");
		overlay = jq ? $(jq) : null || trigger;	
		
		// overlay not found. cannot continue
		if (!overlay.length) { throw "Could not find Overlay: " + jq; }
		
		// if trigger is given - assign it's click event
		if (trigger && trigger.index(overlay) == -1) {
			trigger.click(function(e) {				
				self.load(e);
				return e.preventDefault();
			});
		}   			
		
		// API methods  
		$.extend(self, {

			load: function(e) {
				
				// can be opened only once
				if (self.isOpened()) { return self; }
				
				// find the effect
		 		var eff = effects[conf.effect];
		 		if (!eff) { throw "Overlay: cannot find effect : \"" + conf.effect + "\""; }
				
				// close other instances?
				if (conf.oneInstance) {
					$.each(instances, function() {
						this.close(e);
					});
				}
				
				// onBeforeLoad
				e = e || $.Event();
				e.type = "onBeforeLoad";
				$self.trigger(e);				
				if (e.isDefaultPrevented()) { return self; }				

				// opened
				opened = true;
				
				// possible mask effect
				if (mask) { $.mask.load(overlay, mask); }				
				
				// calculate end position 
				var top = conf.top;					
				var left = conf.left;

				// get overlay dimensions
				var oWidth = overlay.outerWidth({margin:true});
				var oHeight = overlay.outerHeight({margin:true}); 
				
				if (typeof top == 'string')  {
					top = top == 'center' ? Math.max((w.height() - oHeight) / 2, 0) : 
						parseInt(top, 10) / 100 * w.height();			
				}				
				
				if (left == 'center') { left = Math.max((w.width() - oWidth) / 2, 0); }
				
				if (!conf.absolute)  {
					top += w.scrollTop();
					left += w.scrollLeft();
				} 
				
				// position overlay
				overlay.css({top: top, left: left, position: 'absolute'}); 
				
				// onStart
				e.type = "onStart";
				$self.trigger(e); 
				
		 		// load effect  		 		
				eff[0].call(self, function() {					
					if (opened) {
						e.type = "onLoad";
						$self.trigger(e);
					}
				}); 				
		
				// when window is clicked outside overlay, we close
				if (conf.closeOnClick) {
					$(document).bind("click.overlay", function(e) { 
							
						if (!self.isOpened()) { $(this).unbind("click.overlay"); }
						
						// mask.click closes overlay
						if (mask) { return $.mask.getMask().one("click", self.close); }
						
						// otherwize we must click outside the overlay
						var et = $(e.target);
						if (et.parents(overlay).length > 1) { return; }
						
						// close all instances
						$.each(instances, function() {
							this.close(e);
						}); 
					});						
				}						
				
				// keyboard::escape
				if (conf.closeOnEsc) {
					
					// one callback is enough if multiple instances are loaded simultaneously
					$(document).bind("keydown.overlay", function(e) {
						if (e.keyCode == 27) {
							$.each(instances, function() {
								this.close(e);								
							});	 
						}
					});			
				}

				return self; 
			}, 
			
			close: function(e) {

				if (!self.isOpened()) { return self; }
				
				e = e || $.Event();
				e.type = "onBeforeClose";
				$self.trigger(e);				
				if (e.isDefaultPrevented()) { return; }				
				
				opened = false;
				
				// close effect
				effects[conf.effect][1].call(self, function() {
					e.type = "onClose";
					$self.trigger(e); 
				});
				
				// if all instances are closed then we unbind the keyboard / clicking actions
				var allClosed = true;
				$.each(instances, function() {
					if (this.isOpened()) { allClosed = false; }
				});				
				
				if (allClosed) {
					$(document).unbind("click.overlay").unbind("keydown.overlay");		
					$.mask.close();
				} 
							
				return self;
			}, 
			
			getOverlay: function() {
				return overlay;	
			},
			
			getTrigger: function() {
				return trigger;	
			},
			
			getClosers: function() {
				return closers;	
			},			

			isOpened: function()  {
				return opened;
			},
			
			// manipulate start, finish and speeds
			getConf: function() {
				return conf;	
			},

			// bind
			bind: function(name, fn) {
				$self.bind(name, fn);
				return self;	
			},		
			
			// unbind
			unbind: function(name) {
				$self.unbind(name);
				return self;	
			}			
			
		});
		
		// callbacks	
		$.each("onBeforeLoad,onStart,onLoad,onBeforeClose,onClose".split(","), function(i, name) {
				
			// configuration
			if ($.isFunction(conf[name])) { 
				$self.bind(name, conf[name]); 
			}

			// API
			self[name] = function(fn) {
				return self.bind(name, fn);	
			};
		});
		
		// close button
		closers = overlay.find(conf.close || ".close");		
		
		if (!closers.length && !conf.close) {
			closers = $('<div class="close"></div>');
			overlay.prepend(closers);	
		}		
		
		closers.click(function(e) { 
			self.close(e);  
		});					
	}
	
	// jQuery plugin initialization
	$.fn.overlay = function(conf) {   
		
		// already constructed --> return API
		var el = this.eq(typeof conf == 'number' ? conf : 0).data("overlay");
		if (el) { return el; }	  		 
		
		if ($.isFunction(conf)) {
			conf = {onBeforeLoad: conf};	
		}
		
		var globals = $.extend({}, $.tools.overlay.conf); 
		conf = $.extend(true, globals, conf);
		
		this.each(function() {		
			el = new Overlay($(this), conf);
			instances.push(el);
			$(this).data("overlay", el);	
		});
		
		return conf.api ? el: this;		
	}; 
	
})(jQuery);
