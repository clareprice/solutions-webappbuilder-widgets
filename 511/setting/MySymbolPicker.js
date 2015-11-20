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
      clusteringEnabled: null,
      symbolInfo: null,
      symbolType: "",

      // 1) Retain state is jacked up again after the layer symbol changes and the switch from halo/fill color define to fill symbol define
      // 2) Show all symbols when more than one is associated with the renderer..thinking I'll have all symbol things draw below the radio buttons..that way we have the full width and plenty of height o work with
      // 3) Needs to use a loading shelter or whatever...I think that will prevent the flicker while it initally draws
      // 4) 
      // 

      constructor: function ( /*Object*/ options) {
        this.nls = options.nls;
        this.row = options.tr;
        this.layerInfo = options.layerInfo;
        this.renderer = options.layerInfo.renderer;
        this.geometryType = options.layerInfo.geometryType;
        this.symbolInfo = options.symbolInfo;
      },

      postCreate: function () {
        this.inherited(arguments);
        this._loadLayerSymbol();
        this._initSymbolPicker();
        this._initClusterSymbolPicker();
        this._addEventHandlers();
        this._initUI();
      },

      _initUI: function () {
        if (typeof (this.symbolInfo) !== 'undefined') {
          //set retained symbol properties
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
              this._createImageDataDiv(this.symbolInfo.symbol, true);
              break;
          }

          //set cluster options properties
          this.chkClusterSym.set('checked', this.symbolInfo.clusteringEnabled);
          if (typeof (this.symbolInfo.clusterSymbol) !== 'undefined') {
            this.clusterPicker.showBySymbol(jsonUtils.fromJson(this.symbolInfo.clusterSymbol));
          }
        } else {
          //default state
          this.rdoLayerSym.set('checked', true);
          this._rdoEsriSymChanged(false);
          this._rdoCustomSymChanged(false);
          this.chkClusterSym.set('checked', true);
          this.rdoLayerIcon.set('checked', true);
          this._rdoCustomIconChanged(false);
        }
      },

      _createImageDataDiv: function (sym, convert) {
        var symbol = convert ? jsonUtils.fromJson(sym) : sym;

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
          this._editIcon(this.tr, "Symbol");
        })));

        this.own(on(this.uploadCustomIcon, 'click', lang.hitch(this, function (event) {
          this._editIcon(this.tr, "Icon");
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

        var icon;
        if (this.iconType === "LayerIcon") {
          icon = symbol;
        } else {
          if (this.customIconPlaceholder.children.length > 0) {
            if (typeof (this.customIconPlaceholder.children[0].src) !== 'undefined') {
              icon = new PictureMarkerSymbol(this.customIconPlaceholder.children[0].src, 13, 13);
            } else {
              icon = jsonUtils.fromJson(this.symbolInfo.icon);
            }
          } else {
            //TODO show error message here that they need to pick a symbol...or don't care...still deciding
          }
        }

        if (this.clusteringEnabled) {
          this.clusterSymbol = this.clusterPicker.getSymbol().toJson();
        }else{
          this.clusterSymbol = undefined;
        }

        this.symbolInfo = {
          symbolType: this.symbolType,
          symbol: symbol.toJson(),
          clusterSymbol: this.clusterSymbol,
          clusteringEnabled: this.clusteringEnabled,
          icon: icon
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
        html.setStyle(this.grpClusterOptions, 'display', v ? "block" : "none");
      },

      _rdoLayerIconChanged: function (v) {
        if (v) {
          this.iconType = "LayerIcon";
        }
        html.setStyle(this.layerIcon, 'display', v ? "block" : "none");
      },

      _rdoCustomIconChanged: function (v) {
        if (v) {
          this.iconType = "CustomIcon";
        }
        html.setStyle(this.uploadCustomIcon, 'display', v ? "block" : "none");
        html.setStyle(this.customIconPlaceholder, 'display', v ? "block" : "none");
      },

      _initSymbolPicker: function(){
        //var geoType = 'point';//jimuUtils.getTypeByGeometryType(layerInfo.geometryType);
        //var symType = '';
        //if (geoType === 'point') {
        //  symType = 'marker';
        //}
        //else if (geoType === 'polyline') {
        //  symType = 'line';
        //}
        //else if (geoType === 'polygon') {
        //  symType = 'fill';
        //}
        //if (symType) {
        //  this.symbolPicker.showByType(symType);
        //}
        this.symbolPicker.showByType('marker');
      },

      _initClusterSymbolPicker: function () {
        this.clusterPicker.showByType('fill');        
      },

      _loadLayerSymbol: function () {
        if (typeof (this.renderer) !== 'undefined') {
          var renderer = this.renderer;
          if (typeof (renderer.symbol) !== 'undefined') {
            this.symbol = this.renderer.symbol;
            this.layerSym.innerHTML = this._createImageDataDiv(this.symbol, false).innerHTML;
          } else if (typeof (this.renderer.infos) !== 'undefined') {
            //TODO should handle this differently...and show all..then make the user define the core symbol that would draw with the
            //cluster graphic and in the panel

            //this.symbol = this.renderer.infos[0].symbol;

            this.layerSym.innerHTML = this._createCombinedImageDataDiv().innerHTML;
          }
        }

        //This will just show the first symbol for the list...duplicating above while testing
        //this.layerSym.innerHTML = this._createImageDataDiv(this.symbol, false).innerHTML;

        //This will show all of the symbols from the renderer...would still need so way to let the user define the main icon

      },

      _createCombinedImageDataDiv: function () {

        var a = domConstruct.create("div", { class: "imageDataGFXMulti" }, this.customSymbolPlaceholder);

        var infos = this.renderer.infos;
        for (var i = 0; i < infos.length; i++) {
          var symbol = infos[i].symbol;
          var b = domConstruct.create("div", { class: "imageDataGFX imageDataGFX2" }, a);
          if (typeof (symbol.setWidth) !== 'undefined') {
            symbol.setWidth(25);
            symbol.setHeight(25);
          } else {
            if (symbol.size > 20) {
              symbol.setSize(20);
            }
          }

          var mySurface = gfx.createSurface(b, 26, 26);
          var descriptors = jsonUtils.getShapeDescriptors(symbol);
          var shape = mySurface.createShape(descriptors.defaultShape)
                        .setFill(descriptors.fill)
                        .setStroke(descriptors.stroke);
          shape.applyTransform({ dx: 13, dy: 13 });
          a.insertBefore(b, a.firstChild);
          a.appendChild(b);
        }
        return a;
      },

      _editIcon: function (tr, type) {
        var reader = new FileReader();
        reader.onload = lang.hitch(this, function () {
          var node;
          var title;
          if(type === "Symbol"){
            node = this.customSymbolPlaceholder;
            title = this.nls.editCustomSymbol;
          }else{
            node = this.customIconPlaceholder;
            title = this.nls.editCustomIcon;
          }
          node.innerHTML = "<div></div>";

          var a = domConstruct.create("div", {
            class: "customPlaceholder",
            innerHTML: ['<img class="customPlaceholder" src="', reader.result, '"/>'].join(''),
            title: title
          });

          node.innerHTML = a.innerHTML;
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
