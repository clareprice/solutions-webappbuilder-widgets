///////////////////////////////////////////////////////////////////////////
// Copyright © 2015 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define(['dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/xhr',
  'dojo/_base/Color',
  'dojo/topic',
  'dojo/dom-style',
  'dojo/dom'
], function (declare, lang, xhr, Color, topic, domStyle, dom) {
  var themeColorManager = declare(null, {
    _theme: null,
    _styleName: "",
    _styleColor: null,
    _options: null,

    //Public Methods 
    // updateUI(options): Updates UI nodes with the theme color
    //   options: {updateNodes: [{node: <domNode>, styleProp: <style prop like 'background-color'>}]}
    //
    // updateClusterLayers(options): Updates ClusterLayers based on theme color
    //   options: {layerList: <this.layerList>}
    //     layerList is expected to be the same layerList structure from the widget this.layerList

    constructor: function (options) {
      this._theme = options.theme;
      this._styleName = options.stylename;
      this.getStyleColor(this._styleName);
      this._options = options;
    },

    setStyle: function (styleName) {
      this._styleName = styleName;
      this.getStyleColor(this._styleName);
    },

    getStyleColor: function (styleName) {
      var tName = this._theme.name;
      var sName = styleName ? styleName : this._theme.styles[0];
      var url = "././themes/" + tName + "/manifest.json";
      xhr.get({
        url: url,
        handleAs: "json",
        load: lang.hitch(this, function (data) {
          var styles = data.styles;
          for (var i = 0; i < styles.length; i++) {
            var st = styles[i];
            if (st.name === sName) {
              this._styleColor = st.styleColor;
              this.updateUI(this._styleColor);
              break;
            }
          }
        })
      });
    },

    updateUI: function (_styleColor) {
      if (_styleColor) {
        var updateNodes = this._options.updateNodes;
        for (var ii = 0; ii < updateNodes.length; ii++) {
          domStyle.set(updateNodes[ii].node, updateNodes[ii].styleProp, _styleColor);
        }
        this.updateClusterLayerColors(this._options.layerList);
      }
    },

    updateClusterLayerColors: function (layerList) {
      var _rgb = this.hexToRgb(this._styleColor);
      var x = 0;
      var xx = 30;
      var oc = [];
      for (var key in layerList) {
        var l = layerList[key];
        if (l.type === "ClusterLayer") {
          if (l.layerObject.symbolData) {
            if (l.layerObject.symbolData.clusteringEnabled && l.layerObject.symbolData.clusterType === "ThemeCluster") {
              var evenOdd = x % 2 === 0;
              var r = _rgb.r;
              var g = _rgb.g;
              var b = _rgb.b;

              var rr = r - xx;
              if (evenOdd) {
                if (rr > 255) {
                  rr = rr - 255
                }
                else if (rr < 0) {
                  rr = rr + 255
                }
              }

              var bb = b - xx;
              if (x % 3 === 0) {
                if (evenOdd) {
                  if (bb > 255) {
                    bb = bb - 255
                  }
                  else if (bb < 0) {
                    bb = bb + 255
                  }
                }
              }

              var gg = g - xx;
              if (x % 5 === 0) {
                if (evenOdd) {
                  if (gg > 255) {
                    gg = gg - 255
                  }
                  else if (gg < 0) {
                    gg = gg + 255
                  }
                }
              }
              xx = xx + xx;
              l.layerObject.setColor(this.increaseBrightness(this.rgbToHex(rr, gg, bb).replace('.', ''), 1));
              var legendNode = dom.byId("legend_symbol_" + l.layerObject.id);
              if (legendNode) {
                domStyle.set(legendNode, "background-color", this.increaseBrightness(this.rgbToHex(rr, gg, bb).replace('.', ''), 1));
              }
              l.layerObject.clusterFeatures();
            }
          }
        }
      }
    },

    increaseBrightness: function (hex, percent) {
      hex = hex.replace(/^\s*#|\s*$/g, '');
      if (hex.length == 3) {
        hex = hex.replace(/(.)/g, '$1$1');
      }

      var r = parseInt(hex.substr(0, 2), 16),
          g = parseInt(hex.substr(2, 2), 16),
          b = parseInt(hex.substr(4, 2), 16);

      var x = '#' +
         ((0 | (1 << 8) + r + (256 - r) * percent / 100).toString(16)).substr(1) +
         ((0 | (1 << 8) + g + (256 - g) * percent / 100).toString(16)).substr(1) +
         ((0 | (1 << 8) + b + (256 - b) * percent / 100).toString(16)).substr(1);

      return x;
    },

    hexToRgb: function (hex) {
      var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
      });

      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    },

    rgbToHex: function (r, g, b) {
      return "#" + this.cToHex(r) + this.cToHex(g) + this.cToHex(b);
    },

    cToHex: function (c) {
      var hex = c.toString(16);
      return hex.length == 1 ? "0" + hex : hex;
    }
  });

  return themeColorManager;
});