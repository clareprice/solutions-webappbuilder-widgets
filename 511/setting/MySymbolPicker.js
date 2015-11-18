///////////////////////////////////////////////////////////////////////////
// Copyright © 2015 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define(['dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/form/Select',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dojo/_base/html',
    'dojo/dom-style',
    'dojo/dom-construct',
    'dojo/on',
    'dojox/gfx',
    'dojo/_base/Color',
    'dojo/query',
    'esri/symbols/jsonUtils',
    'jimu/dijit/SymbolPicker',
    'jimu/BaseWidget',
    'jimu/dijit/Message',
    'esri/layers/FeatureLayer',
    'esri/symbols/PictureMarkerSymbol',
    'dojo/text!./MySymbolPicker.html',
    'dojo/Evented',
    'jimu/dijit/SimpleTable'
],
  function (declare,
    _WidgetsInTemplateMixin,
    Select,
    array,
    lang,
    html,
    domStyle,
    domConstruct,
    on,
    gfx,
    Color,
    query,
    jsonUtils,
    SymbolPicker1,
    BaseWidget,
    Message,
    FeatureLayer,
    PictureMarkerSymbol,
    template,
    Evented) {
    return declare([BaseWidget, _WidgetsInTemplateMixin, Evented], {
      templateString: template,
      baseClass: 'jimu-widget-511-setting',
      nls: null,
      row: null,
      layerInfo: null,
      _fillColor: '',
      _haloColor:'',
      clusteringEnabled: null,
      symbolInfo: null,
      symbolType: "",
      fillColor: null,
      haloColor: null,

      constructor: function ( /*Object*/ options) {
        this.nls = options.nls;
        this.row = options.tr;
        this.layerInfo = options.layerInfo;
        this.symbol = options.layerInfo.symbol;
        this.geometryType = options.layerInfo.geometryType;
        this.symbolInfo = options.symbolInfo;
      },

      postCreate: function () {
        this.inherited(arguments);
        this._loadLayerSymbol();
        this._initSymbolPicker();
        this._addEventHandlers();
        this._initUI();
      },

      _initUI: function () {
        if (typeof (this.symbolInfo) !== 'undefined') {
          switch (this.symbolInfo.symbolType) {
            case 'LayerSymbol':
              this.rdoLayerSym.set('checked', true);
              this._rdoEsriSymChanged(false);
              this._rdoCustomSymChanged(false);
              break;
            case 'EsriSymbol':
              this.rdoEsriSym.set('checked', true);
              this._rdoLayerSymChanged(false);
              this._rdoCustomSymChanged(false);
              this.symbolPicker.showBySymbol(jsonUtils.fromJson(this.symbolInfo.symbol));
              break;
            case 'CustomSymbol':
              this.rdoCustomSym.set('checked', true);
              this._rdoEsriSymChanged(false);
              this._rdoLayerSymChanged(false);
              this._createImageDataDiv(this.symbolInfo.symbol);
              break;
          }

          this.chkClusterSym.set('checked', this.symbolInfo.clusteringEnabled);

          //set fill props
          this.fillColor = this.symbolInfo.clusterOptions.fillColor;
          var fillDefined = typeof (this.fillColor) !== 'undefined';
          this.chkFillSym.set('checked', fillDefined);
          if(!fillDefined) {
            this._chkFillChanged(false);
          }
          this.fillPicker.setColor(new Color(this.fillColor));

          //set halo props
          this.haloColor = this.symbolInfo.clusterOptions.haloColor;
          var haloDefined = typeof (this.haloColor) !== 'undefined';
          this.chkHaloSym.set('checked', haloDefined);
          if (!haloDefined) {
            this._chkHaloChanged(false);
          }
          this.haloPicker.setColor(new Color(this.haloColor));
        } else {
          this.rdoLayerSym.set('checked', true);
          this._rdoEsriSymChanged(false);
          this._rdoCustomSymChanged(false);
          this.chkClusterSym.set('checked', true);
          this._chkFillChanged(false);
          this._chkHaloChanged(false);
        }
      },

      _createImageDataDiv: function (sym) {
        var symbol = jsonUtils.fromJson(sym);

        if (typeof (symbol.setWidth) !== 'undefined') {
          symbol.setWidth(25);
          symbol.setHeight(25);
        } else {
          if (symbol.size > 20) {
            symbol.setSize(20);
          }
        }
        var a = domConstruct.create("div", { class: "imageDataGFX" }, this.customSymbolPlaceholder);
        var mySurface = gfx.createSurface(a, 26, 26);
        var descriptors = jsonUtils.getShapeDescriptors(symbol);
        var shape = mySurface.createShape(descriptors.defaultShape)
                      .setFill(descriptors.fill)
                      .setStroke(descriptors.stroke);
        shape.applyTransform({ dx: 13, dy: 13 });
        return a;
      },

      _addEventHandlers: function(){
        this.own(on(this.uploadCustomSymbol, 'click', lang.hitch(this, function (event) {
          this._editIcon(this.tr);
        })));

        this.own(on(this.btnOk, 'click', lang.hitch(this, function () {
          this._setSymbol();
          this.emit('ok', this.symbolInfo);
        })));

        this.own(on(this.btnCancel, 'click', lang.hitch(this, function () {
          this.emit('cancel');
        })));
      },

      _setSymbol: function () {
        //regardless of type we need to get and store in a common way 
        var symbol;
        switch (this.symbolType) {
          case 'LayerSymbol':
            // this is only weird if the layer does not use a single symbol
            symbol = this.symbol;
            break;
          case 'EsriSymbol':
            symbol = this.symbolPicker.getSymbol();
            break;
          case 'CustomSymbol':
            if (this.customSymbolPlaceholder.children.length > 0) {
              if (typeof (this.customSymbolPlaceholder.children[0].src) !== 'undefined') {
                symbol = new PictureMarkerSymbol(this.customSymbolPlaceholder.children[0].src, 13, 13);
              } else {
                symbol = jsonUtils.fromJson(this.symbolInfo.symbol);
              }
            } else {
              //TODO show error message here that they need to pick a symbol...or don't care...still deciding
            }
            break;
        }

        if (this.clusteringEnabled) {
          if (this.chkFillSym.checked) {
            this.fillColor = this.fillPicker.getColor().toHex();
          } else {
            this.fillColor = undefined;
          }
          if (this.chkHaloSym.checked) {
            this.haloColor = this.haloPicker.getColor().toHex();
          } else {
            this.haloColor = undefined;
          }
        }

        //set symbolInfo based on popup config
        this.symbolInfo = {
          symbolType: this.symbolType,
          symbol: symbol.toJson(),
          clusteringEnabled: this.clusteringEnabled,
          clusterOptions: {
            fillColor: this.fillColor,
            haloColor: this.haloColor
          }
        };
      },

      _rdoLayerSymChanged: function (v) {
        if (v) {
          this.symbolType = "LayerSymbol";
        }
        html.setStyle(this.layerSym, 'display', v ? "block" : "none");
      },

      _rdoEsriSymChanged: function (v) {
        if (v) {
          this.symbolType = "EsriSymbol";
        }
        html.setStyle(this.symbolPicker.domNode, 'display', v ? "block" : "none");
      },

      _rdoCustomSymChanged: function (v) {
        if (v) {
          this.symbolType = "CustomSymbol";
        }
        html.setStyle(this.uploadCustomSymbol, 'display', v ? "block" : "none");
        html.setStyle(this.customSymbolPlaceholder, 'display', v ? "block" : "none");
      },

      _chkClusterChanged: function (v) {
        this.clusteringEnabled = v;
        this.chkFillSym.set('disabled', !v);
        this.chkHaloSym.set('disabled', !v);
      },

      _chkFillChanged: function (v) {
        html.setStyle(this.fillPicker.domNode, "display", v ? "inline-block" : "none");
      },

      _chkHaloChanged: function (v) {
        html.setStyle(this.haloPicker.domNode, "display", v ? "inline-block" : "none");
      },

      _initSymbolPicker: function(){
        var geoType = 'point';//jimuUtils.getTypeByGeometryType(layerInfo.geometryType);
        var symType = '';
        if (geoType === 'point') {
          symType = 'marker';
        }
        else if (geoType === 'polyline') {
          symType = 'line';
        }
        else if (geoType === 'polygon') {
          symType = 'fill';
        }
        if (symType) {
          this.symbolPicker.showByType(symType);
        }
      },

      _loadLayerSymbol: function () {
        //Not all symbol types return a url...not even sure this is gaurenteed for point symbols
        // may be ok though...if this is expoected to be there for point symbols
        //Would not make sense to define for other geom types but we still do need a icon for the panel
        
        //TODO...maybe I can do the symbol to svg thing here and be pretty safe
        // would still have the issue with non-single symbol rendering
        this.layerSym.innerHTML = ['<img style="width:30px; height:30px;" src="', this.symbol.url, '"/>'].join('');
      },

      _editIcon: function (tr) {
        var reader = new FileReader();
        reader.onload = lang.hitch(this, function () {
          this.customSymbolPlaceholder.innerHTML = "<div></div>";

          var a = domConstruct.create("div", {
            class: "customPlaceholder",
            innerHTML: ['<img class="customPlaceholder" src="', reader.result, '"/>'].join(''),
            title: "Edit Custom Symbol"
          });

          this.customSymbolPlaceholder.innerHTML = a.innerHTML;
        });

        this.fileInput.onchange = lang.hitch(this, function () {
          var f = this.fileInput.files[0];
          reader.readAsDataURL(f);
        });

        this.fileInput.click();
      },

      destroy: function () {
        this.symbolInfo = null;
      }
    });
  });
