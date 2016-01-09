﻿///////////////////////////////////////////////////////////////////////////
// Copyright � 2015 Esri. All Rights Reserved.
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
    'esri/request',
    'jimu/dijit/SymbolPicker',
    'jimu/BaseWidget',
    'jimu/dijit/Message',
    'jimu/utils',
    'esri/layers/FeatureLayer',
    'esri/symbols/PictureMarkerSymbol',
    "esri/symbols/SimpleLineSymbol",
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
    esriRequest,
    SymbolPicker1,
    BaseWidget,
    Message,
    jimuUtils,
    FeatureLayer,
    PictureMarkerSymbol,
    SimpleLineSymbol,
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
      map: null,
      renderSymbols: [],

      // 1) Retain state is jacked up again after the layer symbol changes and the switch from halo/fill color define to fill symbol define
      // 2) Show all symbols when more than one is associated with the renderer..thinking I'll have all symbol things draw below the radio buttons..that way we have the full width and plenty of height o work with
      // 3) Needs to use a loading shelter or whatever...I think that will prevent the flicker while it initally draws
      // 4) Need to set the SVG size relative to the size of the image...no biggie it seems with a symbol that is esentially square...but if the symbol is elongated on the y or the x
      //    then it looks kind of smushed or stretched 
      // 5) Get the Symbol picker moved below its rdo button
      // 6) Need a way to define the symbol size for custom symbol

      constructor: function ( /*Object*/ options) {
        this.nls = options.nls;
        this.row = options.callerRow;
        this.layerInfo = options.layerInfo;
        this.renderer = options.layerInfo.renderer;
        this.geometryType = options.layerInfo.geometryType;
        this.symbolInfo = options.symbolInfo;
        this.map = options.map;
        this.ac = options.ac;
        this.layerId = options.value;
      },

      postCreate: function () {
        this.inherited(arguments);

        //expects a valid geom type definition
        var geoType = jimuUtils.getTypeByGeometryType(this.geometryType);

        this._loadLayerSymbol();
        this._initSymbolPicker(geoType);
        this._initClusterSymbolPicker(geoType);
        this._addEventHandlers(geoType);
        this._initUI();
      },

      _initUI: function () {
        if (typeof (this.symbolInfo) !== 'undefined') {
          //set retained symbol properties
          this.symbolType = this.symbolInfo.symbolType;
          this.clusterType = this.symbolInfo.clusterType;
          this.iconType = this.symbolInfo.iconType;
          this.clusteringEnabled = this.symbolInfo.clusteringEnabled;
          this.userDefinedSymbol = this.symbolInfo.userDefinedSymbol;
          switch (this.symbolInfo.symbolType) {
            case 'LayerSymbol':
              this.rdoLayerSym.set('checked', true);
              this._rdoEsriSymChanged(false);
              this._rdoCustomSymChanged(false);
              break;
            case 'EsriSymbol':
              this.userDefinedSymbol = true;
              this.rdoEsriSym.set('checked', true);
              this._rdoLayerSymChanged(false);
              this._rdoCustomSymChanged(false);
              this.symbolPicker.showBySymbol(jsonUtils.fromJson(this.symbolInfo.symbol));
              break;
            case 'CustomSymbol':
              this.userDefinedSymbol = true;
              this.rdoCustomSym.set('checked', true);
              this._rdoEsriSymChanged(false);
              this._rdoLayerSymChanged(false);

              this._createImageDataDiv(this.symbolInfo.symbol, true, this.customSymbolPlaceholder);
              break;
          }


          //set retained cluster options
          switch (this.symbolInfo.clusterType) {
            case 'ThemeCluster':
              this.userDefinedSymbol = true;
              this.rdoThemeCluster.set('checked', true);
              this.clusterType = 'ThemeCluster';
              break;
            case 'CustomCluster':
              this.userDefinedSymbol = true;
              this.rdoCustomCluster.set('checked', true);
              this.clusterType = 'CustomCluster';
              break;
          }


          switch (this.symbolInfo.iconType) {
            case 'LayerIcon':
              this.rdoLayerIcon.set('checked', true);
              break;
            case 'CustomIcon':
              this.userDefinedSymbol = true;
              this.rdoCustomIcon.set('checked', true);

              if (this.symbolInfo.icon) {
                //this.resetIcon(this.layerInfo.imageData);
                this.resetIcon(this.symbolInfo.icon);
              }
              break;
          }

          //set cluster options properties
          if (typeof (this.symbolInfo.clusterType) !== 'undefined') {
            if (this.symbolInfo.clusterType === "CustomCluster") {
              this.rdoCustomCluster.set('checked', true);
              if (this.symbolInfo.clusterSymbol) {
                this.clusterPicker.showBySymbol(jsonUtils.fromJson(this.symbolInfo.clusterSymbol));
              }
            } else {
              this.rdoThemeCluster.set('checked', true);
            }
            this.userDefinedSymbol = true;
          } 
          this.chkClusterSym.set('checked', this.symbolInfo.clusteringEnabled);
          this._chkClusterChanged(this.symbolInfo.clusteringEnabled);
          
        } else {
          //default state
          this.rdoLayerSym.set('checked', true);
          this._rdoEsriSymChanged(false);
          this._rdoCustomSymChanged(false);
          this.chkClusterSym.set('checked', false);
          this.rdoCustomCluster.set('checked', true);
          this.rdoLayerIcon.set('checked', true);
          this._rdoCustomIconChanged(false);
          this.symbolType = "LayerSymbol";
          this.iconType = "LayerIcon"
          this.clusteringEnabled = false;
          this.userDefinedSymbol = false;
        }

        this._createIconPreviewDiv();
        this._createSymbolPreviewDiv();

        if (this.geometryType !== 'esriGeometryPoint') {
          domStyle.set(this.parent_div_uploadCustomSymbol, "display", "none");
        }
      },

      resetIcon: function (s) {
        this.customIconPlaceholder.innerHTML = "<div></div>";
        var a = domConstruct.create("div", {
          class: "customPlaceholder",
          innerHTML: [s],
          title: this.nls.editCustomIcon
        });

        this.customIconPlaceholder.innerHTML = a.innerHTML;
      },

      _createSymbolPreviewDiv: function () {

      },

      _createIconPreviewDiv: function () {
        var m = this.map;

        var _url, _sr;
        if (typeof (m._layers["defaultBasemap"]) !== 'undefined') {
          _url = m._layers["defaultBasemap"]._url.path;
          _sr = m.spatialReference;
        } else {
          //TODO...would need to handle bboxSR for this...102100  
          _url = "http://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer";
          _sr = "102100";
        }
        ////esriConfig.defaults.io.corsEnabledServers.push("sampleserver1.arcgisonline.com");


        var ext = m.extent;
        esriRequest({
          url: _url + "/export",
          content: {
            f: "json",
            format: "png",
            bbox: ext.xmin + "," + ext.ymin + "," + ext.xmax + "," + ext.ymax,
            size: "300,340",
            bboxSR: _sr
          },
          handleAs: "json",
          load: lang.hitch(this, this.loadFunc),
          error: lang.hitch(this, this.errorFunc)
        }, { usePost: false });
      },

      loadFunc: function (image) {
        domStyle.set(this.symbolPreview, "background-image", "url(" + image.href + ")");
        domStyle.set(this.symbolPreview, "background-repeat", "no-repeat");
      },

      errorFunc: function (error) {
        console.log("Error: ", error.message);
      },

      _addEventHandlers: function (geoType) {
        if (geoType === 'point') {
          this.own(on(this.uploadCustomSymbol, 'click', lang.hitch(this, function (event) {
            this._editIcon(this.tr, "Symbol");
          })));
        }

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
            this.userDefinedSymbol = true;
            symbol = this.symbolPicker.getSymbol();
            break;
          case 'CustomSymbol':
            this.userDefinedSymbol = true;
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
            if (typeof (this.customIconPlaceholder.innerHTML) !== 'undefined') {
              icon = this.customIconPlaceholder.innerHTML;
            } else {
              icon = jsonUtils.fromJson(this.symbolInfo.icon);
            }
          } else {
            //TODO show error message here that they need to pick a symbol...or don't care...still deciding
          }
        }

        if (this.clusteringEnabled && this.geometryType === 'esriGeometryPoint') {
          if (this.clusterType === "ThemeCluster") {
            this.clusterSymbol = "custom";
          } else {
            this.clusterSymbol = this.clusterPicker.getSymbol().toJson();
          }
          this.userDefinedSymbol = true;
        } else {
          this.clusterSymbol = undefined;
          this.clusteringEnabled = false;
        }

        if (symbol) {
          if (typeof (symbol.toJson) !== 'undefined') {
            symbol = symbol.toJson();
          }
        }

        var ssss;
        if (this.customIconPlaceholder.children.length > 0) {
          ssss = this.customIconPlaceholder.children[0].src;
        } else if (this.layerSym.children.length > 0) {
          ssss = this.layerSym.children[0].innerHTML;
        }
        else {
          ssss = this.customIconPlaceholder.outerHTML;
        }

        this.symbolInfo = {
          symbolType: this.symbolType,
          symbol: symbol,
          clusterSymbol: this.clusterSymbol,
          clusteringEnabled: this.clusteringEnabled,
          icon: icon,
          clusterType: this.clusterType,
          iconType: this.iconType,
          renderSymbols: this.renderSymbols,
          renderer: this.renderer,
          s: ssss,
          userDefinedSymbol: this.userDefinedSymbol ? this.userDefinedSymbol : false,
          layerId: this.layerId
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
        html.setStyle(this.grpThemeClusterOptions, 'display', v ? "block" : "none");

        if (v) {
          if (typeof (this.clusterType) === 'undefined') {
            this.clusterType = "CustomCluster";
            this.rdoCustomCluster.set('checked', true);
          }
        }
      },

      _rdoThemeClusterChanged: function (v) {
        if (v) {
          this.clusterType = "ThemeCluster";
        }
      },

      _rdoCustomClusterChanged: function (v) {
        if (v) {
          this.clusterType = "CustomCluster";
        }
      },

      _rdoLayerIconChanged: function (v) {
        if (v) {
          this.iconType = "LayerIcon";
        }
        html.setStyle(this.uploadCustomIcon, 'display', !v ? "block" : "none");
        html.setStyle(this.customIconPlaceholder, 'display', !v ? "block" : "none");
      },

      _rdoCustomIconChanged: function (v) {
        if (v) {
          this.iconType = "CustomIcon";
        }
        html.setStyle(this.uploadCustomIcon, 'display', v ? "block" : "none");
        html.setStyle(this.customIconPlaceholder, 'display', v ? "block" : "none");
      },

      _initSymbolPicker: function (geoType) {
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
        this.symbolPicker.showByType(symType);
      },

      _initClusterSymbolPicker: function (geoType) {
        if (geoType === 'point') {
          this.clusterPicker.showByType('fill');
        }
        var d = geoType === 'point' ? 'block' : 'none';
        domStyle.set(this.parent_div_clusterOptions, "display", d);
      },

      _loadLayerSymbol: function () {

        //TODO check for MapServer renderer types other than just classBreaks and uniqueValues..

        if (typeof (this.renderer) !== 'undefined') {
          var renderer = this.renderer;
          if (typeof (renderer.symbol) !== 'undefined') {
            this.symbol = this.renderer.symbol;
            //this.layerSym.innerHTML = this._createImageDataDiv(this.symbol, false, this.layerSym).innerHTML;
            this._createImageDataDiv(this.renderer.symbol, true, this.layerSym);
          } else if (typeof (this.renderer.infos) !== 'undefined') {
            this.layerSym.innerHTML = this._createCombinedImageDataDiv(this.renderer.infos, false).innerHTML;
          } else if (typeof (this.renderer.uniqueValueInfos) !== 'undefined') {
            this.layerSym.innerHTML = this._createCombinedImageDataDiv(this.renderer.uniqueValueInfos, true).innerHTML;
          } else if (typeof (this.renderer.classBreakInfos) !== 'undefined') {
            this.layerSym.innerHTML = this._createCombinedImageDataDiv(this.renderer.classBreakInfos, true).innerHTML;
          }
        }
      },

      _createImageDataDiv: function (sym, convert, node) {
        var a = domConstruct.create("div", { class: "imageDataGFX" }, node);
        var symbol = convert ? jsonUtils.fromJson(sym) : sym;
        if (!symbol) {
          symbol = sym;
        }
        this.symbol = symbol;
        this.renderSymbols.push(this.symbol);
        var mySurface = gfx.createSurface(a, 26, 26);
        var descriptors = jsonUtils.getShapeDescriptors(this.setSym(symbol));
        var shape = mySurface.createShape(descriptors.defaultShape)
                      .setFill(descriptors.fill)
                      .setStroke(descriptors.stroke);
        shape.applyTransform({ dx: 13, dy: 13 });
        return a;
      },

      _createCombinedImageDataDiv: function (infos, bb) {
        var a = domConstruct.create("div", { class: "imageDataGFXMulti" }, this.customSymbolPlaceholder);

        for (var i = 0; i < infos.length; i++) {
          var sym = infos[i].symbol;
          var symbol = jsonUtils.fromJson(sym);
          if (!symbol) {
            symbol = sym;
          }
          if (typeof (this.symbol) === 'undefined') {
            this.symbol = symbol;
          }
          this.renderSymbols.push(symbol);

          var b = domConstruct.create("div", { class: "imageDataGFX imageDataGFX2" }, a);
          var mySurface = gfx.createSurface(b, 26, 26);
          var descriptors = jsonUtils.getShapeDescriptors(this.setSym(symbol));
          var shape = mySurface.createShape(descriptors.defaultShape)
                        .setFill(descriptors.fill)
                        .setStroke(descriptors.stroke);
          shape.applyTransform({ dx: 13, dy: 13 });
          a.insertBefore(b, a.firstChild);
          a.appendChild(b);
        }
        return a;
      },

      setSym: function (symbol) {
        if (typeof (symbol.setWidth) !== 'undefined') {
          if (this.geometryType === 'esriGeometryPoint') {
            symbol.setWidth(25);
          }
          if (typeof (symbol.setHeight) !== 'undefined') {
            symbol.setHeight(25);
          }
        } else {
          //used for point symbols from hosted services
          if (typeof (symbol.size) !== 'undefined') {
            if (symbol.size > 20) {
              symbol.setSize(20);
            }
          }
          //used for point symbols from MapServer services
          if (typeof (symbol.width) !== 'undefined') {
            symbol.width = 20;
          }
          if (typeof (symbol.height) !== 'undefined') {
            symbol.height = 20;
          }
        }
     
        return symbol;
      },

      _editIcon: function (tr, type) {
        var reader = new FileReader();
        reader.onload = lang.hitch(this, function () {
          var node;
          var title;
          if (type === "Symbol") {
            node = this.customSymbolPlaceholder;
            title = this.nls.editCustomSymbol;
          } else {
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
