/*!
 * IE10 viewport hack for Surface/desktop Windows 8 bug
 * Copyright 2014-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */

// See the Getting Started docs for more information:
// http://getbootstrap.com/getting-started/#support-ie10-width

(function () {
  'use strict';

  if (navigator.userAgent.match(/IEMobile\/10\.0/)) {
    var msViewportStyle = document.createElement('style')
    msViewportStyle.appendChild(
      document.createTextNode(
        '@-ms-viewport{width:auto!important}'
      )
    )
    document.querySelector('head').appendChild(msViewportStyle)
  }

})();

/*!
 * jquery.okayNav.js 2.0.4 (https://github.com/VPenkov/okayNav)
 * Author: Vergil Penkov (http://vergilpenkov.com/)
 * MIT license: https://opensource.org/licenses/MIT
 */

;
(function(factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory); // AMD
    } else if (typeof module === 'object' && module.exports) {
        module.exports = function(root, jQuery) { // Node/CommonJS
            if (jQuery === undefined) {
                if (typeof window !== 'undefined') {
                    jQuery = require('jquery');
                } else {
                    jQuery = require('jquery')(root);
                }
            }
            factory(jQuery);
            return jQuery;
        };
    } else {
        factory(jQuery); // Browser globals
    }
}(function($) {
    // Defaults

    var okayNav = 'okayNav',
        defaults = {
            parent: '', // will call nav's parent() by default
            toggle_icon_class: 'okayNav__menu-toggle',
            toggle_icon_content: '<span /><span /><span />',
            align_right: true, // If false, the menu and the kebab icon will be on the left
            swipe_enabled: true, // If true, you'll be able to swipe left/right to open the navigation
            threshold: 50, // Nav will auto open/close if swiped >= this many percent
            resize_delay: 10, // When resizing the window, okayNav can throttle its recalculations if enabled. Setting this to 50-250 will improve performance but make okayNav less accurate.
            beforeOpen: function() {}, // Will trigger before the nav gets opened
            afterOpen: function() {}, // Will trigger after the nav gets opened
            beforeClose: function() {}, // Will trigger before the nav gets closed
            afterClose: function() {}, // Will trigger after the nav gets closed
            itemHidden: function() {},
            itemDisplayed: function() {}
        };

    // Begin
    function Plugin(element, options) {
        var self = this;
        this.options = $.extend({}, defaults, options);

        self.navigation = $(element);
        self.document = $(document);
        self.window = $(window);

        this.options.parent == '' ? this.options.parent = self.navigation.parent() : '';

        self.nav_open = false; // Store the state of the hidden nav
        self.parent_full_width = 0;

        // Swipe stuff
        self.radCoef = 180 / Math.PI;
        self.sTouch = {
            x: 0,
            y: 0
        };
        self.cTouch = {
            x: 0,
            y: 0
        };
        self.sTime = 0;
        self.nav_position = 0;
        self.percent_open = 0;
        self.nav_moving = false;


        self.init();
    }

    $.extend(Plugin.prototype, {

        init: function() {
            var self = this;

            $('body').addClass('okayNav-loaded');

            // Add classes
            self.navigation
                .addClass('okayNav loaded')
                .children('ul').addClass('okayNav__nav--visible');

            // Append elements
            if (self.options.align_right) {
                self.navigation
                    .append('<ul class="okayNav__nav--invisible transition-enabled nav-right" />')
                    .append('<a href="#" class="' + self.options.toggle_icon_class + ' okay-invisible">' + self.options.toggle_icon_content + '</a>')
            } else {
                self.navigation
                    .prepend('<ul class="okayNav__nav--invisible transition-enabled nav-left" />')
                    .prepend('<a href="#" class="' + self.options.toggle_icon_class + ' okay-invisible">' + self.options.toggle_icon_content + '</a>')
            }

            // Cache new elements for further use
            self.nav_visible = self.navigation.children('.okayNav__nav--visible');
            self.nav_invisible = self.navigation.children('.okayNav__nav--invisible');
            self.toggle_icon = self.navigation.children('.' + self.options.toggle_icon_class);

            self.toggle_icon_width = self.toggle_icon.outerWidth(true);
            self.default_width = self.getChildrenWidth(self.navigation);
            self.parent_full_width = $(self.options.parent).outerWidth(true);
            self.last_visible_child_width = 0; // We'll define this later

            // Events are up once everything is set
            self.initEvents();

            // Trim white spaces between visible nav elements
            self.nav_visible.contents().filter(function() {
                return this.nodeType = Node.TEXT_NODE && /\S/.test(this.nodeValue) === false;
            }).remove();

            if (self.options.swipe_enabled == true) self.initSwipeEvents();
        },

        initEvents: function() {
            var self = this;
            // Toggle hidden nav when hamburger icon is clicked and
            // Collapse hidden nav on click outside the header
            self.document.on('click.okayNav', function(e) {
                var _target = $(e.target);

                if (self.nav_open === true && _target.closest('.okayNav').length == 0)
                    self.closeInvisibleNav();

                if (e.target === self.toggle_icon.get(0)) {
                    e.preventDefault();
                    self.toggleInvisibleNav();
                }
            });

            var optimizeResize = self._debounce(function() {
                self.recalcNav()
            }, self.options.resize_delay);
            self.window.on('load.okayNav resize.okayNav', optimizeResize);
        },

        initSwipeEvents: function() {
            var self = this;
            self.document
                .on('touchstart.okayNav', function(e) {
                    self.nav_invisible.removeClass('transition-enabled');

                    //Trigger only on touch with one finger
                    if (e.originalEvent.touches.length == 1) {
                        var touch = e.originalEvent.touches[0];
                        if (
                            ((touch.pageX < 25 && self.options.align_right == false) ||
                                (touch.pageX > ($(self.options.parent).outerWidth(true) - 25) &&
                                    self.options.align_right == true)) ||
                            self.nav_open === true) {

                            self.sTouch.x = self.cTouch.x = touch.pageX;
                            self.sTouch.y = self.cTouch.y = touch.pageY;
                            self.sTime = Date.now();
                        }

                    }
                })
                .on('touchmove.okayNav', function(e) {
                    var touch = e.originalEvent.touches[0];
                    self._triggerMove(touch.pageX, touch.pageY);
                    self.nav_moving = true;
                })
                .on('touchend.okayNav', function(e) {
                    self.sTouch = {
                        x: 0,
                        y: 0
                    };
                    self.cTouch = {
                        x: 0,
                        y: 0
                    };
                    self.sTime = 0;

                    //Close menu if not swiped enough
                    if (self.percent_open > (100 - self.options.threshold)) {
                        self.nav_position = 0;
                        self.closeInvisibleNav();

                    } else if (self.nav_moving == true) {
                        self.nav_position = self.nav_invisible.width();
                        self.openInvisibleNav();
                    }

                    self.nav_moving = false;

                    self.nav_invisible.addClass('transition-enabled');
                });
        },

        _getDirection: function(dx) {
            if (this.options.align_right) {
                return (dx > 0) ? -1 : 1;
            } else {
                return (dx < 0) ? -1 : 1;
            }
        },

        _triggerMove: function(x, y) {
            var self = this;

            self.cTouch.x = x;
            self.cTouch.y = y;

            var currentTime = Date.now();
            var dx = (self.cTouch.x - self.sTouch.x);
            var dy = (self.cTouch.y - self.sTouch.y);

            var opposing = dy * dy;
            var distance = Math.sqrt(dx * dx + opposing);
            //Length of the opposing side of the 90deg triagle
            var dOpposing = Math.sqrt(opposing);

            var angle = Math.asin(Math.sin(dOpposing / distance)) * self.radCoef;
            var speed = distance / (currentTime - self.sTime);

            //Set new start position
            self.sTouch.x = x;
            self.sTouch.y = y;

            //Remove false swipes
            if (angle < 20) {
                var dir = self._getDirection(dx);

                var newPos = self.nav_position + dir * distance;
                var menuWidth = self.nav_invisible.width();
                var overflow = 0;


                if (newPos < 0) {
                    overflow = -newPos;
                } else if (newPos > menuWidth) {
                    overflow = menuWidth - newPos;
                }

                var size = menuWidth - (self.nav_position + dir * distance + overflow);
                var threshold = (size / menuWidth) * 100;

                //Set new position and threshold
                self.nav_position += dir * distance + overflow;
                self.percent_open = threshold;

                // self.nav_invisible.css('transform', 'translateX(' + (self.options.align_right ? 1 : -1) * threshold + '%)');
            }

        },

        /*
         * A few methods to allow working with elements
         */
        getParent: function() {
            return this.options.parent;
        },

        getVisibleNav: function() { // Visible navigation
            return this.nav_visible;
        },

        getInvisibleNav: function() { // Hidden behind the kebab icon
            return this.nav_invisible;
        },

        getNavToggleIcon: function() { // Kebab icon
            return this.toggle_icon;
        },

        /*
         * Operations
         */
        _debounce: function(func, wait, immediate) {
            var timeout;
            return function() {
                var context = this,
                    args = arguments;
                var later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        },

        openInvisibleNav: function() {
            var self = this;

            !self.options.enable_swipe ? self.options.beforeOpen.call() : '';

            self.toggle_icon.addClass('icon--active');
            self.nav_invisible.addClass('nav-open');
            self.nav_open = true;
            // self.nav_invisible.css({
            //     '-webkit-transform': 'translateX(0%)',
            //     'transform': 'translateX(0%)'
            // });

            self.options.afterOpen.call();
        },

        closeInvisibleNav: function() {
            var self = this;
            !self.options.enable_swipe ? self.options.beforeClose.call() : '';

            self.toggle_icon.removeClass('icon--active');
            self.nav_invisible.removeClass('nav-open');

            // if (self.options.align_right) {
            //     self.nav_invisible.css({
            //         '-webkit-transform': 'translateX(100%)',
            //         'transform': 'translateX(100%)'
            //     });
            // } else {
            //     self.nav_invisible.css({
            //         '-webkit-transform': 'translateX(-100%)',
            //         'transform': 'translateX(-100%)'
            //     });
            // }
            self.nav_open = false;

            self.options.afterClose.call();
        },

        toggleInvisibleNav: function() {
            var self = this;
            if (!self.nav_open) {
                self.openInvisibleNav();
            } else {
                self.closeInvisibleNav();
            }
        },


        /*
         * Math stuff
         */
        getChildrenWidth: function(el) {
            var children_width = 0;
            var children = $(el).children();
            for (var i = 0; i < children.length; i++) {
                children_width += $(children[i]).outerWidth(true);
            };

            return children_width;
        },

        getVisibleItemCount: function() {
            return $('li', this.nav_visible).length;
        },
        getHiddenItemCount: function() {
            return $('li', this.nav_invisible).length;
        },

        recalcNav: function() {
            var self = this;
            var wrapper_width = $(self.options.parent).outerWidth(true),
                space_taken = self.getChildrenWidth(self.options.parent),
                nav_full_width = self.navigation.outerWidth(true),
                visible_nav_items = self.getVisibleItemCount(),
                collapse_width = self.nav_visible.outerWidth(true) + self.toggle_icon_width,
                expand_width = space_taken + self.last_visible_child_width + self.toggle_icon_width,
                expandAll_width = space_taken - nav_full_width + self.default_width;

            if (wrapper_width > expandAll_width) {
                self._expandAllItems();
                self.toggle_icon.addClass('okay-invisible');
                return;
            }

            if (visible_nav_items > 0 &&
                nav_full_width <= collapse_width &&
                wrapper_width <= expand_width) {
                self._collapseNavItem();
            }

            if (wrapper_width > expand_width + self.toggle_icon_width + 15) {
                self._expandNavItem();
            }


            // Hide the kebab icon if no items are hidden
            self.getHiddenItemCount() == 0 ?
                self.toggle_icon.addClass('okay-invisible') :
                self.toggle_icon.removeClass('okay-invisible');
        },

        _collapseNavItem: function() {
            var self = this;
            var $last_child = $('li:last-child', self.nav_visible);
            self.last_visible_child_width = $last_child.outerWidth(true);
            self.document.trigger('okayNav:collapseItem', $last_child);
            $last_child.detach().prependTo(self.nav_invisible);
            self.options.itemHidden.call();
            // All nav items are visible by default
            // so we only need recursion when collapsing

            self.recalcNav();
        },

        _expandNavItem: function() {
            var self = this;
            var $first = $('li:first-child', self.nav_invisible);
            self.document.trigger('okayNav:expandItem', $first);
            $first.detach().appendTo(self.nav_visible);
            self.options.itemDisplayed.call();
        },

        _expandAllItems: function() {
            var self = this;
            $('li', self.nav_invisible).detach().appendTo(self.nav_visible);
            self.options.itemDisplayed.call();
        },

        _collapseAllItems: function() {
            var self = this;
            $('li', self.nav_visible).detach().appendTo(self.nav_invisible);
            self.options.itemHidden.call();
        },

        destroy: function() {
            var self = this;
            $('li', self.nav_invisible).appendTo(self.nav_visible);
            self.nav_invisible.remove();
            self.nav_visible.removeClass('okayNav__nav--visible');
            self.toggle_icon.remove();

            self.document.unbind('.okayNav');
            self.window.unbind('.okayNav');
        }

    });

    // Plugin wrapper
    $.fn[okayNav] = function(options) {
        var args = arguments;

        if (options === undefined || typeof options === 'object') {
            return this.each(function() {
                if (!$.data(this, 'plugin_' + okayNav)) {
                    $.data(this, 'plugin_' + okayNav, new Plugin(this, options));
                }
            });

        } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {

            var returns;
            this.each(function() {
                var instance = $.data(this, 'plugin_' + okayNav);
                if (instance instanceof Plugin && typeof instance[options] === 'function') {
                    returns = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                }

                if (options === 'destroy') {
                    $.data(this, 'plugin_' + okayNav, null);
                }
            });

            return returns !== undefined ? returns : this;
        }
    };
}));

/*! ###########################################################################

 Source: https://github.com/dutchcelt/Keep-in-View

 Copyright (C) 2011 - 2013,  Lunatech Labs B.V., C. Egor Kloos. All rights reserved.
 GNU General Public License, version 3 (GPL-3.0)

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see http://www.opensource.org/licenses/gpl-3.0.html

 ########################################################################### */

// Uses AMD or browser globals to create a jQuery plugin.

(function(factory) {

  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['jquery'], factory);
  } else {
    // Browser globals
    factory(jQuery);
  }

}(function($) {

  $.fn.keepInView = function(settings) {

    return this.each(function(index, stickyElem) {

      var $elem;
      var $parent;

      var defaults = {

        // Position will be fixed regardless of scroll position when set to true
        fixed: false,

        // Vertical offset that applies to both top and bottom;
        edgeOffset: 0,

        // Override z-index if you can't or don't want to set this with CSS
        zindex: $(stickyElem).css('zIndex'),

        // Override all scripted positions with your own custom CSS classname
        // The set classname will be triggered when element scrolls out of view
        // The Script will add a suffix of '-top' or '-bottom'
        customClass: false,

        //  Only trigger this script on scrolling out at the 'top', 'bottom' the default is 'both'.
        trigger: 'both',

        // Scrollable box
        scrollable: false,

        //  Set the height and width (user can override these if necessary)
        h: $(stickyElem).height(),
        w: $(stickyElem).width(),

        //  If a pageload scrolls to a hash you can use this to offset anchors if the 'sticky' element is covering the anchored content
        //  Beware that if the anchor itself contains content that it will also move up the page.
        //  This feature is best used with the clone feature below.
        offsetAnchor: false, // boolean.

        //  Clone the sticky element and prepend to its parent.
        //  Beware that the original item is not removed from the page so make sure that the cloned element will cover it.
        //  The cloned item can be styled via the classname "KIV-cloned"
        cloned: false // boolean.

      };

      var options = $.extend({}, defaults, settings);

      if (options.cloned) {
        $parent = $(stickyElem).parents().eq(0);
        $elem = $(stickyElem).clone().prependTo($parent).hide().addClass("KIV-cloned");
        $(stickyElem).addClass("KIV-original")
      } else {
        $elem = $(stickyElem);
      }

      var offset = $(stickyElem).offset(),
        position = $(stickyElem).css('position'),
        leftPosition = $(stickyElem).css('left'),
        marginOffset = (leftPosition === "auto") ? parseInt($(stickyElem).css('marginLeft'), 10) : 0,
        cssObject = (function() {
          return {
            position: 'fixed',
            left: leftPosition - marginOffset + 'px',
            width: (options.scrollable) ? options.w - 15 : options.w,
            height: (options.scrollable) ? ($(window).height() - offset.top) + "px" : options.h,
            zIndex: options.zindex
          }
        })(),
        prepCSS = function(cssSettings) {
          $elem.css($.extend({}, cssObject, cssSettings));
        },
        fixCSS = function(t) {
          $elem.css({ top: t + 'px' });
          if (options.offsetAnchor) {
            $(stickyElem).css({ visibility: "hidden" });
            $elem.slideDown("normal");
          }
        }

      if (options.offsetAnchor) {

        // It is possible that there a lot of anchors!
        // Using an array instead of a loop by 'shifting' the array
        // This speeds up the iterations and setTimeout prevents the browser from locking up.

        // put all the dom elements collected by jQuery in to an array
        var $anchors = $("a[name]");
        var anchorArray = $.makeArray($anchors);

        var arrayShifter = function() {

          var start = +new Date();

          do {

            var anchor = anchorArray.shift();
            //  Invoke lazyLoad method with the current item
            if (anchorArray[0] !== void 0) {
              $(anchor).css({ position: "relative", display: "block", top: "-" + $elem.outerHeight() + "px" });
            }

          } while (anchorArray[0] !== void 0 && (+new Date() - start < 50)); // increase to 100ms if needed.

          if (anchorArray[0] !== void 0) {
            setTimeout(arrayShifter, 0);
          }

        };
        arrayShifter();
      }


      var setElem = function(opts) {

        //  Making sure that $elem doesn't fire if it is taller than the window (like a sidebar)
        //  To prevent elastic scrolling fireing set the body in css to 'overflow: hidden'.
        //  Then wrap your content in a div with 'overflow: auto'.

        if ($elem.height() > $(window).height() && !options.scrollable) {
          return false;
        }

        if (options.clearStyle) {
          $elem.removeAttr("style");
        }
        var scrolledOutAt = "";
        var windowHeight = $(window).height();
        var outerHeight = $elem.outerHeight();
        $parent = $(stickyElem).parents().eq(0);
        if (windowHeight < parseInt(offset.top + outerHeight - Math.abs($(window).scrollTop()) + options.edgeOffset, 10) && !options.fixed) {
          scrolledOutAt = "bottom";
        }

        if (($(window).scrollTop()) > offset.top - options.edgeOffset && !options.fixed) {
          scrolledOutAt = "top";
        }

        // if (!options.customClass) {


        if (options.scrollable) {
          prepCSS({ height: (windowHeight - offset.top) + "px", overflow: "auto" });
        } else {
          prepCSS();

        }

        if (scrolledOutAt === "bottom" && (options.trigger === 'both' || options.trigger === 'bottom')) {
          if (options.scrollable) {
            prepCSS({ height: windowHeight + "px", top: (windowHeight - outerHeight - options.edgeOffset) + "px", overflow: "auto" });
          } else {
            fixCSS((windowHeight - outerHeight - options.edgeOffset));
          }

        } else if (scrolledOutAt === "top" && (options.trigger === 'both' || options.trigger === 'top')) {
          if (options.scrollable) {
            prepCSS({ height: windowHeight + "px", top: options.edgeOffset + "px", overflow: "auto" });
          } else {
            fixCSS(options.edgeOffset);
          }

        } else if (options.fixed) {
          $elem.css({ top: options.edgeOffset, left: offset.left, height: "auto" });
        } else {
          if (options.scrollable) {
            $elem.css({ position: position, top: offset.top + "px", height: (windowHeight - offset.top + $(window).scrollTop()) + "px" });
          } else {
            if (options.offsetAnchor) {
              $(stickyElem).css({ visibility: "visible" });
              $elem.hide();
            } else {
              $elem.removeAttr('style');
            }
          }
        }

        // } else 
        if (options.customClass) {
          // console.log(scrolledOutAt);
          if (options.trigger === 'both') {
            if (scrolledOutAt === "bottom" || scrolledOutAt === "top") {
              $elem.addClass(options.customClass + "-" + scrolledOutAt);
            } else if (!scrolledOutAt) {
              $elem.removeClass(options.customClass + "-top").removeClass(options.customClass + "-bottom");
            }
          } else if (scrolledOutAt === options.trigger) {
            $elem.addClass(options.customClass + "-" + options.trigger);
          } else if (!scrolledOutAt) {
            $elem.removeClass(options.customClass + "-" + options.trigger);
          }
        }

        if (options.parentClass) {
          if (options.trigger === 'both') {
          	var elemClass = options.customClass + "-";
            if ($parent.find('[class*="'+elemClass+'"]')) {
              $parent.addClass(options.parentClass);
            } else {
              $parent.removeClass(options.parentClass);
            }
          } else if (scrolledOutAt === options.trigger) {
          	var elemClass = options.customClass + "-" + options.trigger;
            if ($parent.find('[class*="'+elemClass+'"]')) {
              $parent.addClass(options.parentClass);
            } else {
              $parent.removeClass(options.parentClass);
            }
          } else if (!scrolledOutAt) {
            $parent.removeClass(options.parentClass);
          }
        }
        // end if
      }

      var staySticky = function() {
        options.w = $elem.width();
        options.h = $elem.height();
        offset = $elem.offset();
        options.clearStyle = true;
        requestAnimationFrame(setElem);
      }
      var setElemRequest = function() {
        options.clearStyle = false;
        requestAnimationFrame(setElem);
      }

      var killSticky = function() {
        $elem.removeAttr('style').off(".sticky");
        $(window).off('.sticky', staySticky).off('.sticky', setElemRequest);
      }

      $elem.on('update.sticky', staySticky);
      $elem.on('unstick.sticky', killSticky);
      $(window).on('resize.sticky', $elem, staySticky).on('scroll.sticky', $elem, setElemRequest).trigger('scroll');

    });
  };

}));

/* ========================================================================
 * Bootstrap: collapse.js v3.3.7
 * http://getbootstrap.com/javascript/#collapse
 * ========================================================================
 * Copyright 2011-2016 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */

/* jshint latedef: false */

+function ($) {
  'use strict';

  // COLLAPSE PUBLIC CLASS DEFINITION
  // ================================

  var Collapse = function (element, options) {
    this.$element      = $(element)
    this.options       = $.extend({}, Collapse.DEFAULTS, options)
    this.$trigger      = $('[data-toggle="collapse"][href="#' + element.id + '"],' +
                           '[data-toggle="collapse"][data-target="#' + element.id + '"]')
    this.transitioning = null

    if (this.options.parent) {
      this.$parent = this.getParent()
    } else {
      this.addAriaAndCollapsedClass(this.$element, this.$trigger)
    }

    if (this.options.toggle) this.toggle()
  }

  Collapse.VERSION  = '3.3.7'

  Collapse.TRANSITION_DURATION = 350

  Collapse.DEFAULTS = {
    toggle: true
  }

  Collapse.prototype.dimension = function () {
    var hasWidth = this.$element.hasClass('width')
    return hasWidth ? 'width' : 'height'
  }

  Collapse.prototype.show = function () {
    if (this.transitioning || this.$element.hasClass('in')) return

    var activesData
    var actives = this.$parent && this.$parent.children('.panel').children('.in, .collapsing')

    if (actives && actives.length) {
      activesData = actives.data('bs.collapse')
      if (activesData && activesData.transitioning) return
    }

    var startEvent = $.Event('show.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    if (actives && actives.length) {
      Plugin.call(actives, 'hide')
      activesData || actives.data('bs.collapse', null)
    }

    var dimension = this.dimension()

    this.$element
      .removeClass('collapse')
      .addClass('collapsing')[dimension](0)
      .attr('aria-expanded', true)

    this.$trigger
      .removeClass('collapsed')
      .attr('aria-expanded', true)

    this.transitioning = 1

    var complete = function () {
      this.$element
        .removeClass('collapsing')
        .addClass('collapse in')[dimension]('')
      this.transitioning = 0
      this.$element
        .trigger('shown.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    var scrollSize = $.camelCase(['scroll', dimension].join('-'))

    this.$element
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)[dimension](this.$element[0][scrollSize])
  }

  Collapse.prototype.hide = function () {
    if (this.transitioning || !this.$element.hasClass('in')) return

    var startEvent = $.Event('hide.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    var dimension = this.dimension()

    this.$element[dimension](this.$element[dimension]())[0].offsetHeight

    this.$element
      .addClass('collapsing')
      .removeClass('collapse in')
      .attr('aria-expanded', false)

    this.$trigger
      .addClass('collapsed')
      .attr('aria-expanded', false)

    this.transitioning = 1

    var complete = function () {
      this.transitioning = 0
      this.$element
        .removeClass('collapsing')
        .addClass('collapse')
        .trigger('hidden.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    this.$element
      [dimension](0)
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)
  }

  Collapse.prototype.toggle = function () {
    this[this.$element.hasClass('in') ? 'hide' : 'show']()
  }

  Collapse.prototype.getParent = function () {
    return $(this.options.parent)
      .find('[data-toggle="collapse"][data-parent="' + this.options.parent + '"]')
      .each($.proxy(function (i, element) {
        var $element = $(element)
        this.addAriaAndCollapsedClass(getTargetFromTrigger($element), $element)
      }, this))
      .end()
  }

  Collapse.prototype.addAriaAndCollapsedClass = function ($element, $trigger) {
    var isOpen = $element.hasClass('in')

    $element.attr('aria-expanded', isOpen)
    $trigger
      .toggleClass('collapsed', !isOpen)
      .attr('aria-expanded', isOpen)
  }

  function getTargetFromTrigger($trigger) {
    var href
    var target = $trigger.attr('data-target')
      || (href = $trigger.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') // strip for ie7

    return $(target)
  }


  // COLLAPSE PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.collapse')
      var options = $.extend({}, Collapse.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data && options.toggle && /show|hide/.test(option)) options.toggle = false
      if (!data) $this.data('bs.collapse', (data = new Collapse(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.collapse

  $.fn.collapse             = Plugin
  $.fn.collapse.Constructor = Collapse


  // COLLAPSE NO CONFLICT
  // ====================

  $.fn.collapse.noConflict = function () {
    $.fn.collapse = old
    return this
  }


  // COLLAPSE DATA-API
  // =================

  $(document).on('click.bs.collapse.data-api', '[data-toggle="collapse"]', function (e) {
    var $this   = $(this)

    if (!$this.attr('data-target')) e.preventDefault()

    var $target = getTargetFromTrigger($this)
    var data    = $target.data('bs.collapse')
    var option  = data ? 'toggle' : $this.data()

    Plugin.call($target, option)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: modal.js v3.3.7
 * http://getbootstrap.com/javascript/#modals
 * ========================================================================
 * Copyright 2011-2016 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // MODAL CLASS DEFINITION
  // ======================

  var Modal = function (element, options) {
    this.options             = options
    this.$body               = $(document.body)
    this.$element            = $(element)
    this.$dialog             = this.$element.find('.modal-dialog')
    this.$backdrop           = null
    this.isShown             = null
    this.originalBodyPad     = null
    this.scrollbarWidth      = 0
    this.ignoreBackdropClick = false

    if (this.options.remote) {
      this.$element
        .find('.modal-content')
        .load(this.options.remote, $.proxy(function () {
          this.$element.trigger('loaded.bs.modal')
        }, this))
    }
  }

  Modal.VERSION  = '3.3.7'

  Modal.TRANSITION_DURATION = 300
  Modal.BACKDROP_TRANSITION_DURATION = 150

  Modal.DEFAULTS = {
    backdrop: true,
    keyboard: true,
    show: true
  }

  Modal.prototype.toggle = function (_relatedTarget) {
    return this.isShown ? this.hide() : this.show(_relatedTarget)
  }

  Modal.prototype.show = function (_relatedTarget) {
    var that = this
    var e    = $.Event('show.bs.modal', { relatedTarget: _relatedTarget })

    this.$element.trigger(e)

    if (this.isShown || e.isDefaultPrevented()) return

    this.isShown = true

    this.checkScrollbar()
    this.setScrollbar()
    this.$body.addClass('modal-open')

    this.escape()
    this.resize()

    this.$element.on('click.dismiss.bs.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this))

    this.$dialog.on('mousedown.dismiss.bs.modal', function () {
      that.$element.one('mouseup.dismiss.bs.modal', function (e) {
        if ($(e.target).is(that.$element)) that.ignoreBackdropClick = true
      })
    })

    this.backdrop(function () {
      var transition = $.support.transition && that.$element.hasClass('fade')

      if (!that.$element.parent().length) {
        that.$element.appendTo(that.$body) // don't move modals dom position
      }

      that.$element
        .show()
        .scrollTop(0)

      that.adjustDialog()

      if (transition) {
        that.$element[0].offsetWidth // force reflow
      }

      that.$element.addClass('in')

      that.enforceFocus()

      var e = $.Event('shown.bs.modal', { relatedTarget: _relatedTarget })

      transition ?
        that.$dialog // wait for modal to slide in
          .one('bsTransitionEnd', function () {
            that.$element.trigger('focus').trigger(e)
          })
          .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
        that.$element.trigger('focus').trigger(e)
    })
  }

  Modal.prototype.hide = function (e) {
    if (e) e.preventDefault()

    e = $.Event('hide.bs.modal')

    this.$element.trigger(e)

    if (!this.isShown || e.isDefaultPrevented()) return

    this.isShown = false

    this.escape()
    this.resize()

    $(document).off('focusin.bs.modal')

    this.$element
      .removeClass('in')
      .off('click.dismiss.bs.modal')
      .off('mouseup.dismiss.bs.modal')

    this.$dialog.off('mousedown.dismiss.bs.modal')

    $.support.transition && this.$element.hasClass('fade') ?
      this.$element
        .one('bsTransitionEnd', $.proxy(this.hideModal, this))
        .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
      this.hideModal()
  }

  Modal.prototype.enforceFocus = function () {
    $(document)
      .off('focusin.bs.modal') // guard against infinite focus loop
      .on('focusin.bs.modal', $.proxy(function (e) {
        if (document !== e.target &&
            this.$element[0] !== e.target &&
            !this.$element.has(e.target).length) {
          this.$element.trigger('focus')
        }
      }, this))
  }

  Modal.prototype.escape = function () {
    if (this.isShown && this.options.keyboard) {
      this.$element.on('keydown.dismiss.bs.modal', $.proxy(function (e) {
        e.which == 27 && this.hide()
      }, this))
    } else if (!this.isShown) {
      this.$element.off('keydown.dismiss.bs.modal')
    }
  }

  Modal.prototype.resize = function () {
    if (this.isShown) {
      $(window).on('resize.bs.modal', $.proxy(this.handleUpdate, this))
    } else {
      $(window).off('resize.bs.modal')
    }
  }

  Modal.prototype.hideModal = function () {
    var that = this
    this.$element.hide()
    this.backdrop(function () {
      that.$body.removeClass('modal-open')
      that.resetAdjustments()
      that.resetScrollbar()
      that.$element.trigger('hidden.bs.modal')
    })
  }

  Modal.prototype.removeBackdrop = function () {
    this.$backdrop && this.$backdrop.remove()
    this.$backdrop = null
  }

  Modal.prototype.backdrop = function (callback) {
    var that = this
    var animate = this.$element.hasClass('fade') ? 'fade' : ''

    if (this.isShown && this.options.backdrop) {
      var doAnimate = $.support.transition && animate

      this.$backdrop = $(document.createElement('div'))
        .addClass('modal-backdrop ' + animate)
        .appendTo(this.$body)

      this.$element.on('click.dismiss.bs.modal', $.proxy(function (e) {
        if (this.ignoreBackdropClick) {
          this.ignoreBackdropClick = false
          return
        }
        if (e.target !== e.currentTarget) return
        this.options.backdrop == 'static'
          ? this.$element[0].focus()
          : this.hide()
      }, this))

      if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

      this.$backdrop.addClass('in')

      if (!callback) return

      doAnimate ?
        this.$backdrop
          .one('bsTransitionEnd', callback)
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
        callback()

    } else if (!this.isShown && this.$backdrop) {
      this.$backdrop.removeClass('in')

      var callbackRemove = function () {
        that.removeBackdrop()
        callback && callback()
      }
      $.support.transition && this.$element.hasClass('fade') ?
        this.$backdrop
          .one('bsTransitionEnd', callbackRemove)
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
        callbackRemove()

    } else if (callback) {
      callback()
    }
  }

  // these following methods are used to handle overflowing modals

  Modal.prototype.handleUpdate = function () {
    this.adjustDialog()
  }

  Modal.prototype.adjustDialog = function () {
    var modalIsOverflowing = this.$element[0].scrollHeight > document.documentElement.clientHeight

    this.$element.css({
      paddingLeft:  !this.bodyIsOverflowing && modalIsOverflowing ? this.scrollbarWidth : '',
      paddingRight: this.bodyIsOverflowing && !modalIsOverflowing ? this.scrollbarWidth : ''
    })
  }

  Modal.prototype.resetAdjustments = function () {
    this.$element.css({
      paddingLeft: '',
      paddingRight: ''
    })
  }

  Modal.prototype.checkScrollbar = function () {
    var fullWindowWidth = window.innerWidth
    if (!fullWindowWidth) { // workaround for missing window.innerWidth in IE8
      var documentElementRect = document.documentElement.getBoundingClientRect()
      fullWindowWidth = documentElementRect.right - Math.abs(documentElementRect.left)
    }
    this.bodyIsOverflowing = document.body.clientWidth < fullWindowWidth
    this.scrollbarWidth = this.measureScrollbar()
  }

  Modal.prototype.setScrollbar = function () {
    var bodyPad = parseInt((this.$body.css('padding-right') || 0), 10)
    this.originalBodyPad = document.body.style.paddingRight || ''
    if (this.bodyIsOverflowing) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)
  }

  Modal.prototype.resetScrollbar = function () {
    this.$body.css('padding-right', this.originalBodyPad)
  }

  Modal.prototype.measureScrollbar = function () { // thx walsh
    var scrollDiv = document.createElement('div')
    scrollDiv.className = 'modal-scrollbar-measure'
    this.$body.append(scrollDiv)
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
    this.$body[0].removeChild(scrollDiv)
    return scrollbarWidth
  }


  // MODAL PLUGIN DEFINITION
  // =======================

  function Plugin(option, _relatedTarget) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.modal')
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data) $this.data('bs.modal', (data = new Modal(this, options)))
      if (typeof option == 'string') data[option](_relatedTarget)
      else if (options.show) data.show(_relatedTarget)
    })
  }

  var old = $.fn.modal

  $.fn.modal             = Plugin
  $.fn.modal.Constructor = Modal


  // MODAL NO CONFLICT
  // =================

  $.fn.modal.noConflict = function () {
    $.fn.modal = old
    return this
  }


  // MODAL DATA-API
  // ==============

  $(document).on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {
    var $this   = $(this)
    var href    = $this.attr('href')
    var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) // strip for ie7
    var option  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())

    if ($this.is('a')) e.preventDefault()

    $target.one('show.bs.modal', function (showEvent) {
      if (showEvent.isDefaultPrevented()) return // only register focus restorer if modal will actually get shown
      $target.one('hidden.bs.modal', function () {
        $this.is(':visible') && $this.trigger('focus')
      })
    })
    Plugin.call($target, option, this)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: scrollspy.js v3.3.7
 * http://getbootstrap.com/javascript/#scrollspy
 * ========================================================================
 * Copyright 2011-2016 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // SCROLLSPY CLASS DEFINITION
  // ==========================

  function ScrollSpy(element, options) {
    this.$body          = $(document.body)
    this.$scrollElement = $(element).is(document.body) ? $(window) : $(element)
    this.options        = $.extend({}, ScrollSpy.DEFAULTS, options)
    this.selector       = (this.options.target || '') + ' .nav li > a'
    this.offsets        = []
    this.targets        = []
    this.activeTarget   = null
    this.scrollHeight   = 0

    this.$scrollElement.on('scroll.bs.scrollspy', $.proxy(this.process, this))
    this.refresh()
    this.process()
  }

  ScrollSpy.VERSION  = '3.3.7'

  ScrollSpy.DEFAULTS = {
    offset: 10
  }

  ScrollSpy.prototype.getScrollHeight = function () {
    return this.$scrollElement[0].scrollHeight || Math.max(this.$body[0].scrollHeight, document.documentElement.scrollHeight)
  }

  ScrollSpy.prototype.refresh = function () {
    var that          = this
    var offsetMethod  = 'offset'
    var offsetBase    = 0

    this.offsets      = []
    this.targets      = []
    this.scrollHeight = this.getScrollHeight()

    if (!$.isWindow(this.$scrollElement[0])) {
      offsetMethod = 'position'
      offsetBase   = this.$scrollElement.scrollTop()
    }

    this.$body
      .find(this.selector)
      .map(function () {
        var $el   = $(this)
        var href  = $el.data('target') || $el.attr('href')
        var $href = /^#./.test(href) && $(href)

        return ($href
          && $href.length
          && $href.is(':visible')
          && [[$href[offsetMethod]().top + offsetBase, href]]) || null
      })
      .sort(function (a, b) { return a[0] - b[0] })
      .each(function () {
        that.offsets.push(this[0])
        that.targets.push(this[1])
      })
  }

  ScrollSpy.prototype.process = function () {
    var scrollTop    = this.$scrollElement.scrollTop() + this.options.offset
    var scrollHeight = this.getScrollHeight()
    var maxScroll    = this.options.offset + scrollHeight - this.$scrollElement.height()
    var offsets      = this.offsets
    var targets      = this.targets
    var activeTarget = this.activeTarget
    var i

    if (this.scrollHeight != scrollHeight) {
      this.refresh()
    }

    if (scrollTop >= maxScroll) {
      return activeTarget != (i = targets[targets.length - 1]) && this.activate(i)
    }

    if (activeTarget && scrollTop < offsets[0]) {
      this.activeTarget = null
      return this.clear()
    }

    for (i = offsets.length; i--;) {
      activeTarget != targets[i]
        && scrollTop >= offsets[i]
        && (offsets[i + 1] === undefined || scrollTop < offsets[i + 1])
        && this.activate(targets[i])
    }
  }

  ScrollSpy.prototype.activate = function (target) {
    this.activeTarget = target

    this.clear()

    var selector = this.selector +
      '[data-target="' + target + '"],' +
      this.selector + '[href="' + target + '"]'

    var active = $(selector)
      .parents('li')
      .addClass('active')

    if (active.parent('.dropdown-menu').length) {
      active = active
        .closest('li.dropdown')
        .addClass('active')
    }

    active.trigger('activate.bs.scrollspy')
  }

  ScrollSpy.prototype.clear = function () {
    $(this.selector)
      .parentsUntil(this.options.target, '.active')
      .removeClass('active')
  }


  // SCROLLSPY PLUGIN DEFINITION
  // ===========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.scrollspy')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.scrollspy', (data = new ScrollSpy(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.scrollspy

  $.fn.scrollspy             = Plugin
  $.fn.scrollspy.Constructor = ScrollSpy


  // SCROLLSPY NO CONFLICT
  // =====================

  $.fn.scrollspy.noConflict = function () {
    $.fn.scrollspy = old
    return this
  }


  // SCROLLSPY DATA-API
  // ==================

  $(window).on('load.bs.scrollspy.data-api', function () {
    $('[data-spy="scroll"]').each(function () {
      var $spy = $(this)
      Plugin.call($spy, $spy.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: tab.js v3.3.7
 * http://getbootstrap.com/javascript/#tabs
 * ========================================================================
 * Copyright 2011-2016 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // TAB CLASS DEFINITION
  // ====================

  var Tab = function (element) {
    // jscs:disable requireDollarBeforejQueryAssignment
    this.element = $(element)
    // jscs:enable requireDollarBeforejQueryAssignment
  }

  Tab.VERSION = '3.3.7'

  Tab.TRANSITION_DURATION = 150

  Tab.prototype.show = function () {
    var $this    = this.element
    var $ul      = $this.closest('ul:not(.dropdown-menu)')
    var selector = $this.data('target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    if ($this.parent('li').hasClass('active')) return

    var $previous = $ul.find('.active:last a')
    var hideEvent = $.Event('hide.bs.tab', {
      relatedTarget: $this[0]
    })
    var showEvent = $.Event('show.bs.tab', {
      relatedTarget: $previous[0]
    })

    $previous.trigger(hideEvent)
    $this.trigger(showEvent)

    if (showEvent.isDefaultPrevented() || hideEvent.isDefaultPrevented()) return

    var $target = $(selector)

    this.activate($this.closest('li'), $ul)
    this.activate($target, $target.parent(), function () {
      $previous.trigger({
        type: 'hidden.bs.tab',
        relatedTarget: $this[0]
      })
      $this.trigger({
        type: 'shown.bs.tab',
        relatedTarget: $previous[0]
      })
    })
  }

  Tab.prototype.activate = function (element, container, callback) {
    var $active    = container.find('> .active')
    var transition = callback
      && $.support.transition
      && ($active.length && $active.hasClass('fade') || !!container.find('> .fade').length)

    function next() {
      $active
        .removeClass('active')
        .find('> .dropdown-menu > .active')
          .removeClass('active')
        .end()
        .find('[data-toggle="tab"]')
          .attr('aria-expanded', false)

      element
        .addClass('active')
        .find('[data-toggle="tab"]')
          .attr('aria-expanded', true)

      if (transition) {
        element[0].offsetWidth // reflow for transition
        element.addClass('in')
      } else {
        element.removeClass('fade')
      }

      if (element.parent('.dropdown-menu').length) {
        element
          .closest('li.dropdown')
            .addClass('active')
          .end()
          .find('[data-toggle="tab"]')
            .attr('aria-expanded', true)
      }

      callback && callback()
    }

    $active.length && transition ?
      $active
        .one('bsTransitionEnd', next)
        .emulateTransitionEnd(Tab.TRANSITION_DURATION) :
      next()

    $active.removeClass('in')
  }


  // TAB PLUGIN DEFINITION
  // =====================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.tab')

      if (!data) $this.data('bs.tab', (data = new Tab(this)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tab

  $.fn.tab             = Plugin
  $.fn.tab.Constructor = Tab


  // TAB NO CONFLICT
  // ===============

  $.fn.tab.noConflict = function () {
    $.fn.tab = old
    return this
  }


  // TAB DATA-API
  // ============

  var clickHandler = function (e) {
    e.preventDefault()
    Plugin.call($(this), 'show')
  }

  $(document)
    .on('click.bs.tab.data-api', '[data-toggle="tab"]', clickHandler)
    .on('click.bs.tab.data-api', '[data-toggle="pill"]', clickHandler)

}(jQuery);

/* ========================================================================
 * Bootstrap: tooltip.js v3.3.7
 * http://getbootstrap.com/javascript/#tooltip
 * Inspired by the original jQuery.tipsy by Jason Frame
 * ========================================================================
 * Copyright 2011-2016 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // TOOLTIP PUBLIC CLASS DEFINITION
  // ===============================

  var Tooltip = function (element, options) {
    this.type       = null
    this.options    = null
    this.enabled    = null
    this.timeout    = null
    this.hoverState = null
    this.$element   = null
    this.inState    = null

    this.init('tooltip', element, options)
  }

  Tooltip.VERSION  = '3.3.7'

  Tooltip.TRANSITION_DURATION = 150

  Tooltip.DEFAULTS = {
    animation: true,
    placement: 'top',
    selector: false,
    template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',
    title: '',
    delay: 0,
    html: false,
    container: false,
    viewport: {
      selector: 'body',
      padding: 0
    }
  }

  Tooltip.prototype.init = function (type, element, options) {
    this.enabled   = true
    this.type      = type
    this.$element  = $(element)
    this.options   = this.getOptions(options)
    this.$viewport = this.options.viewport && $($.isFunction(this.options.viewport) ? this.options.viewport.call(this, this.$element) : (this.options.viewport.selector || this.options.viewport))
    this.inState   = { click: false, hover: false, focus: false }

    if (this.$element[0] instanceof document.constructor && !this.options.selector) {
      throw new Error('`selector` option must be specified when initializing ' + this.type + ' on the window.document object!')
    }

    var triggers = this.options.trigger.split(' ')

    for (var i = triggers.length; i--;) {
      var trigger = triggers[i]

      if (trigger == 'click') {
        this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
      } else if (trigger != 'manual') {
        var eventIn  = trigger == 'hover' ? 'mouseenter' : 'focusin'
        var eventOut = trigger == 'hover' ? 'mouseleave' : 'focusout'

        this.$element.on(eventIn  + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
        this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
      }
    }

    this.options.selector ?
      (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
      this.fixTitle()
  }

  Tooltip.prototype.getDefaults = function () {
    return Tooltip.DEFAULTS
  }

  Tooltip.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    if (options.delay && typeof options.delay == 'number') {
      options.delay = {
        show: options.delay,
        hide: options.delay
      }
    }

    return options
  }

  Tooltip.prototype.getDelegateOptions = function () {
    var options  = {}
    var defaults = this.getDefaults()

    this._options && $.each(this._options, function (key, value) {
      if (defaults[key] != value) options[key] = value
    })

    return options
  }

  Tooltip.prototype.enter = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    if (obj instanceof $.Event) {
      self.inState[obj.type == 'focusin' ? 'focus' : 'hover'] = true
    }

    if (self.tip().hasClass('in') || self.hoverState == 'in') {
      self.hoverState = 'in'
      return
    }

    clearTimeout(self.timeout)

    self.hoverState = 'in'

    if (!self.options.delay || !self.options.delay.show) return self.show()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'in') self.show()
    }, self.options.delay.show)
  }

  Tooltip.prototype.isInStateTrue = function () {
    for (var key in this.inState) {
      if (this.inState[key]) return true
    }

    return false
  }

  Tooltip.prototype.leave = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    if (obj instanceof $.Event) {
      self.inState[obj.type == 'focusout' ? 'focus' : 'hover'] = false
    }

    if (self.isInStateTrue()) return

    clearTimeout(self.timeout)

    self.hoverState = 'out'

    if (!self.options.delay || !self.options.delay.hide) return self.hide()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'out') self.hide()
    }, self.options.delay.hide)
  }

  Tooltip.prototype.show = function () {
    var e = $.Event('show.bs.' + this.type)

    if (this.hasContent() && this.enabled) {
      this.$element.trigger(e)

      var inDom = $.contains(this.$element[0].ownerDocument.documentElement, this.$element[0])
      if (e.isDefaultPrevented() || !inDom) return
      var that = this

      var $tip = this.tip()

      var tipId = this.getUID(this.type)

      this.setContent()
      $tip.attr('id', tipId)
      this.$element.attr('aria-describedby', tipId)

      if (this.options.animation) $tip.addClass('fade')

      var placement = typeof this.options.placement == 'function' ?
        this.options.placement.call(this, $tip[0], this.$element[0]) :
        this.options.placement

      var autoToken = /\s?auto?\s?/i
      var autoPlace = autoToken.test(placement)
      if (autoPlace) placement = placement.replace(autoToken, '') || 'top'

      $tip
        .detach()
        .css({ top: 0, left: 0, display: 'block' })
        .addClass(placement)
        .data('bs.' + this.type, this)

      this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)
      this.$element.trigger('inserted.bs.' + this.type)

      var pos          = this.getPosition()
      var actualWidth  = $tip[0].offsetWidth
      var actualHeight = $tip[0].offsetHeight

      if (autoPlace) {
        var orgPlacement = placement
        var viewportDim = this.getPosition(this.$viewport)

        placement = placement == 'bottom' && pos.bottom + actualHeight > viewportDim.bottom ? 'top'    :
                    placement == 'top'    && pos.top    - actualHeight < viewportDim.top    ? 'bottom' :
                    placement == 'right'  && pos.right  + actualWidth  > viewportDim.width  ? 'left'   :
                    placement == 'left'   && pos.left   - actualWidth  < viewportDim.left   ? 'right'  :
                    placement

        $tip
          .removeClass(orgPlacement)
          .addClass(placement)
      }

      var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)

      this.applyPlacement(calculatedOffset, placement)

      var complete = function () {
        var prevHoverState = that.hoverState
        that.$element.trigger('shown.bs.' + that.type)
        that.hoverState = null

        if (prevHoverState == 'out') that.leave(that)
      }

      $.support.transition && this.$tip.hasClass('fade') ?
        $tip
          .one('bsTransitionEnd', complete)
          .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
        complete()
    }
  }

  Tooltip.prototype.applyPlacement = function (offset, placement) {
    var $tip   = this.tip()
    var width  = $tip[0].offsetWidth
    var height = $tip[0].offsetHeight

    // manually read margins because getBoundingClientRect includes difference
    var marginTop = parseInt($tip.css('margin-top'), 10)
    var marginLeft = parseInt($tip.css('margin-left'), 10)

    // we must check for NaN for ie 8/9
    if (isNaN(marginTop))  marginTop  = 0
    if (isNaN(marginLeft)) marginLeft = 0

    offset.top  += marginTop
    offset.left += marginLeft

    // $.fn.offset doesn't round pixel values
    // so we use setOffset directly with our own function B-0
    $.offset.setOffset($tip[0], $.extend({
      using: function (props) {
        $tip.css({
          top: Math.round(props.top),
          left: Math.round(props.left)
        })
      }
    }, offset), 0)

    $tip.addClass('in')

    // check to see if placing tip in new offset caused the tip to resize itself
    var actualWidth  = $tip[0].offsetWidth
    var actualHeight = $tip[0].offsetHeight

    if (placement == 'top' && actualHeight != height) {
      offset.top = offset.top + height - actualHeight
    }

    var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)

    if (delta.left) offset.left += delta.left
    else offset.top += delta.top

    var isVertical          = /top|bottom/.test(placement)
    var arrowDelta          = isVertical ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
    var arrowOffsetPosition = isVertical ? 'offsetWidth' : 'offsetHeight'

    $tip.offset(offset)
    this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], isVertical)
  }

  Tooltip.prototype.replaceArrow = function (delta, dimension, isVertical) {
    this.arrow()
      .css(isVertical ? 'left' : 'top', 50 * (1 - delta / dimension) + '%')
      .css(isVertical ? 'top' : 'left', '')
  }

  Tooltip.prototype.setContent = function () {
    var $tip  = this.tip()
    var title = this.getTitle()

    $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
    $tip.removeClass('fade in top bottom left right')
  }

  Tooltip.prototype.hide = function (callback) {
    var that = this
    var $tip = $(this.$tip)
    var e    = $.Event('hide.bs.' + this.type)

    function complete() {
      if (that.hoverState != 'in') $tip.detach()
      if (that.$element) { // TODO: Check whether guarding this code with this `if` is really necessary.
        that.$element
          .removeAttr('aria-describedby')
          .trigger('hidden.bs.' + that.type)
      }
      callback && callback()
    }

    this.$element.trigger(e)

    if (e.isDefaultPrevented()) return

    $tip.removeClass('in')

    $.support.transition && $tip.hasClass('fade') ?
      $tip
        .one('bsTransitionEnd', complete)
        .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
      complete()

    this.hoverState = null

    return this
  }

  Tooltip.prototype.fixTitle = function () {
    var $e = this.$element
    if ($e.attr('title') || typeof $e.attr('data-original-title') != 'string') {
      $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
    }
  }

  Tooltip.prototype.hasContent = function () {
    return this.getTitle()
  }

  Tooltip.prototype.getPosition = function ($element) {
    $element   = $element || this.$element

    var el     = $element[0]
    var isBody = el.tagName == 'BODY'

    var elRect    = el.getBoundingClientRect()
    if (elRect.width == null) {
      // width and height are missing in IE8, so compute them manually; see https://github.com/twbs/bootstrap/issues/14093
      elRect = $.extend({}, elRect, { width: elRect.right - elRect.left, height: elRect.bottom - elRect.top })
    }
    var isSvg = window.SVGElement && el instanceof window.SVGElement
    // Avoid using $.offset() on SVGs since it gives incorrect results in jQuery 3.
    // See https://github.com/twbs/bootstrap/issues/20280
    var elOffset  = isBody ? { top: 0, left: 0 } : (isSvg ? null : $element.offset())
    var scroll    = { scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop() }
    var outerDims = isBody ? { width: $(window).width(), height: $(window).height() } : null

    return $.extend({}, elRect, scroll, outerDims, elOffset)
  }

  Tooltip.prototype.getCalculatedOffset = function (placement, pos, actualWidth, actualHeight) {
    return placement == 'bottom' ? { top: pos.top + pos.height,   left: pos.left + pos.width / 2 - actualWidth / 2 } :
           placement == 'top'    ? { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2 } :
           placement == 'left'   ? { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth } :
        /* placement == 'right' */ { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width }

  }

  Tooltip.prototype.getViewportAdjustedDelta = function (placement, pos, actualWidth, actualHeight) {
    var delta = { top: 0, left: 0 }
    if (!this.$viewport) return delta

    var viewportPadding = this.options.viewport && this.options.viewport.padding || 0
    var viewportDimensions = this.getPosition(this.$viewport)

    if (/right|left/.test(placement)) {
      var topEdgeOffset    = pos.top - viewportPadding - viewportDimensions.scroll
      var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight
      if (topEdgeOffset < viewportDimensions.top) { // top overflow
        delta.top = viewportDimensions.top - topEdgeOffset
      } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) { // bottom overflow
        delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset
      }
    } else {
      var leftEdgeOffset  = pos.left - viewportPadding
      var rightEdgeOffset = pos.left + viewportPadding + actualWidth
      if (leftEdgeOffset < viewportDimensions.left) { // left overflow
        delta.left = viewportDimensions.left - leftEdgeOffset
      } else if (rightEdgeOffset > viewportDimensions.right) { // right overflow
        delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset
      }
    }

    return delta
  }

  Tooltip.prototype.getTitle = function () {
    var title
    var $e = this.$element
    var o  = this.options

    title = $e.attr('data-original-title')
      || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)

    return title
  }

  Tooltip.prototype.getUID = function (prefix) {
    do prefix += ~~(Math.random() * 1000000)
    while (document.getElementById(prefix))
    return prefix
  }

  Tooltip.prototype.tip = function () {
    if (!this.$tip) {
      this.$tip = $(this.options.template)
      if (this.$tip.length != 1) {
        throw new Error(this.type + ' `template` option must consist of exactly 1 top-level element!')
      }
    }
    return this.$tip
  }

  Tooltip.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.tooltip-arrow'))
  }

  Tooltip.prototype.enable = function () {
    this.enabled = true
  }

  Tooltip.prototype.disable = function () {
    this.enabled = false
  }

  Tooltip.prototype.toggleEnabled = function () {
    this.enabled = !this.enabled
  }

  Tooltip.prototype.toggle = function (e) {
    var self = this
    if (e) {
      self = $(e.currentTarget).data('bs.' + this.type)
      if (!self) {
        self = new this.constructor(e.currentTarget, this.getDelegateOptions())
        $(e.currentTarget).data('bs.' + this.type, self)
      }
    }

    if (e) {
      self.inState.click = !self.inState.click
      if (self.isInStateTrue()) self.enter(self)
      else self.leave(self)
    } else {
      self.tip().hasClass('in') ? self.leave(self) : self.enter(self)
    }
  }

  Tooltip.prototype.destroy = function () {
    var that = this
    clearTimeout(this.timeout)
    this.hide(function () {
      that.$element.off('.' + that.type).removeData('bs.' + that.type)
      if (that.$tip) {
        that.$tip.detach()
      }
      that.$tip = null
      that.$arrow = null
      that.$viewport = null
      that.$element = null
    })
  }


  // TOOLTIP PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.tooltip')
      var options = typeof option == 'object' && option

      if (!data && /destroy|hide/.test(option)) return
      if (!data) $this.data('bs.tooltip', (data = new Tooltip(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tooltip

  $.fn.tooltip             = Plugin
  $.fn.tooltip.Constructor = Tooltip


  // TOOLTIP NO CONFLICT
  // ===================

  $.fn.tooltip.noConflict = function () {
    $.fn.tooltip = old
    return this
  }

}(jQuery);

/* ========================================================================
 * Bootstrap: transition.js v3.3.7
 * http://getbootstrap.com/javascript/#transitions
 * ========================================================================
 * Copyright 2011-2016 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CSS TRANSITION SUPPORT (Shoutout: http://www.modernizr.com/)
  // ============================================================

  function transitionEnd() {
    var el = document.createElement('bootstrap')

    var transEndEventNames = {
      WebkitTransition : 'webkitTransitionEnd',
      MozTransition    : 'transitionend',
      OTransition      : 'oTransitionEnd otransitionend',
      transition       : 'transitionend'
    }

    for (var name in transEndEventNames) {
      if (el.style[name] !== undefined) {
        return { end: transEndEventNames[name] }
      }
    }

    return false // explicit for ie8 (  ._.)
  }

  // http://blog.alexmaccaw.com/css-transitions
  $.fn.emulateTransitionEnd = function (duration) {
    var called = false
    var $el = this
    $(this).one('bsTransitionEnd', function () { called = true })
    var callback = function () { if (!called) $($el).trigger($.support.transition.end) }
    setTimeout(callback, duration)
    return this
  }

  $(function () {
    $.support.transition = transitionEnd()

    if (!$.support.transition) return

    $.event.special.bsTransitionEnd = {
      bindType: $.support.transition.end,
      delegateType: $.support.transition.end,
      handle: function (e) {
        if ($(e.target).is(this)) return e.handleObj.handler.apply(this, arguments)
      }
    }
  })

}(jQuery);

//# sourceMappingURL=plugin.js.map
