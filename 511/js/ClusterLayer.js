///////////////////////////////////////////////////////////////////////////
// Copyright � 2015 Esri. All Rights Reserved.
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

define([
   'dojo/_base/declare',
   'dojo/_base/array',
   'dojo/_base/event',
   'dojo/_base/lang',
   'dojo/_base/Color',
   'dojo/on',
   'dojo/DeferredList',
   'esri/layers/GraphicsLayer',
   'esri/graphic',
   'esri/SpatialReference',
   'esri/geometry/Extent',
   'esri/geometry/Point',
   'esri/symbols/PictureMarkerSymbol',
   'esri/symbols/SimpleMarkerSymbol',
   'esri/symbols/SimpleLineSymbol',
   'esri/request',
   'esri/tasks/query',
   'esri/tasks/QueryTask',
   'esri/symbols/jsonUtils',
   "esri/arcgis/utils"
], function (declare, array, dojoEvent, lang, Color, on, DeferredList, GraphicsLayer, Graphic, SpatialReference, Extent, Point, PictureMarkerSymbol, SimpleMarkerSymbol, SimpleLineSymbol, esriRequest, Query, QueryTask, jsonUtils, arcgisUtils) {
  var clusterLayer = declare('ClusterLayer', [GraphicsLayer], {

    cancelRequest: false,
    icon: null,

    constructor: function (options) {
      this._parentLayer = options.parentLayer;
      this.clusterGraphics = null;
      this.cancelRequest = false;
      this.name = options.name;
      this.displayOnPan = options.displayOnPan || false;
      this._map = options.map;
      this.clusterSize = options.clusterSize || 120;
      this.colorStr = options.color || '#ff0000';
      this.color = Color.fromString(this.colorStr);
      this.filter = options.filter;
      this.symbolData = options.symbolData;
      this.itemId = options.itemId;
      this.renderSymbols = options.renderSymbols;
      this.renderer = options.renderer ? options.renderer : options.symbolData.renderer;
      this.imD = options.imD;
      this.imD2 = options.imD2;
      this.s = options.s;
      this.refresh = options.refresh;
      //this.idx = options.idx;
      
      //this.tcm = options.ttccmm;

      this._setupSymbols();

      /////////////////////////
      this._singles = []; // populated when a graphic is clicked
      //this._showSingles = options.hasOwnProperty("showSingles") ? options.showSingles : true;
      this._showSingles = true;
      var symColor = this.color.toRgb();
      var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);

      //if (typeof (this.symbolData) !== 'undefined') {
      //  //TODO would want to set to a defined smaller size
      //  this._singleSym = this.symbolData.symbol;
      //}
      this._singleSym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 9, cls, new Color([symColor[0], symColor[1], symColor[2], 0.5]));
      //this._singleTemplate = options.singleTemplate || new PopupTemplate({ "title": "", "description": "{*}" });
      this._maxSingles = options.maxSingles || 1000;
      /////////////////////////
      this.icon = options.icon;
      this.node = options.node;
      this._features = options.features;
      this.id = options.id;
      //this.query = options.query;
      //this.queryPending = false;
      this.infoTemplate = options.infoTemplate;

      //TODO May be better to check and do this loop in settings also
      if (!this.infoTemplate) {
        if (typeof (this._parentLayer.originOperLayer) !== 'undefined') {
          if (typeof (this._parentLayer.originOperLayer.parentLayerInfo) !== 'undefined') {
            if (typeof (this._parentLayer.originOperLayer.parentLayerInfo.controlPopupInfo) !== 'undefined') {
              var popupInfos = this._parentLayer.originOperLayer.parentLayerInfo.controlPopupInfo.infoTemplates;
              if (popupInfos) {
                var url = this._parentLayerObject.url;
                var index = url.substr(url.lastIndexOf('/') + 1);
                if (popupInfos.hasOwnProperty(index)) {
                  this.infoTemplate = popupInfos[index].infoTemplate;
                }
              }
            }
          }
        }
      }

      this._fieldNames = [];
      //this will limit the fields to those fequired for the popup
      if (this.infoTemplate) {
        if (typeof (this.infoTemplate.info) !== 'undefined') {
          var fieldInfos = this.infoTemplate.info.fieldInfos;
          for (var i = 0; i < fieldInfos.length; i++) {
            if (fieldInfos[i].visible) {
              this._fieldNames.push(fieldInfos[i].fieldName);
            }
          }
        }
      }
      if (this._fieldNames.length < 1) {
        //get all fields
        this._fieldNames = ["*"]
      }

      this.url = options.url;
      if (typeof (this._features) === 'undefined') {
        if (typeof (this.url) !== 'undefined') {
          this.loadData(this.url);
        } else {
          this.loaded = "error";
        }
      }
      else {
        this.loaded = true;
      }

      if (this.loaded !== "error") {
        //base connections to update clusters during user/map interaction
        this.extentChangeSignal = this._map.on('extent-change', lang.hitch(this, this.handleMapExtentChange));
        //handles the loading and mouse events on the graphics
        this.clickSignal = this.on('click', lang.hitch(this, this.handleClick));
      }

    },

    clearSingles: function (singles) {
      // Summary:  Remove graphics that represent individual data points.
      var s = singles || this._singles;
      array.forEach(s, function (g) {
        this.remove(g);
      }, this);
      this._singles.length = 0;
    },

    _addSingles: function (singles) {
      // add single graphics to the map
      //arrayUtils.forEach(singles, function (p) {
      //  var g = new Graphic(
      //    new Point(p.x, p.y, this._sr),
      //    this._singleSym,
      //    p.attributes,
      //    this._singleTemplate
      //  );
      //  this._singles.push(g);
      //  if (this._showSingles) {
      //    this.add(g);
      //  }
      //}, this);
      array.forEach(singles, function (p) {
        var g = new Graphic(
          new Point(p.geometry.x, p.geometry.y, this._map.spatialReference),
          this._singleSym,
          p.attributes
        );
        this._singles.push(g);
        if (this._showSingles) {
          this.add(g);
        }
      }, this);
      this._map.infoWindow.setFeatures(this._singles);
    },

    initalCount: function (url) {
      var q = new Query();
      q.returnGeometry = false;
      q.geometry = this._map.extent;
      var qt = new QueryTask(url);
      qt.executeForIds(q).then(lang.hitch(this, function (results) {
        if (this.node) {
          this.node.innerHTML = results ? results.length : 0;
        }
      }));
    },

    loadData: function (url) {
      if (url.length > 0) {
        this.initalCount(url);
        var q = new Query();
        q.where = typeof(this.filter) !== 'undefined' ? this.filter.expr : "1=1";
        q.returnGeometry = false;
        this.queryPending = true;
        var qt = new QueryTask(url);
        qt.executeForIds(q).then(lang.hitch(this, function (results) {
          var max = 1000;
          if (results) {
            this.queryIDs = results;
            var queries = [];
            var i, j;
            for (i = 0, j = this.queryIDs.length; i < j; i += max) {
              var ids = this.queryIDs.slice(i, i + max);
              queries.push(esriRequest({
                "url": url + "/query",
                "content": {
                  "f": "json",
                  "outFields": this._fieldNames.join(),
                  "objectids": ids.join(),
                  "returnGeometry": "true",
                  "outSR": this._map.spatialReference.wkid
                }
              }));
            }

            this._features = [];
            if (!this.cancelRequest) {
              var queryList = new DeferredList(queries);
              queryList.then(lang.hitch(this, function (queryResults) {
                this.queryPending = false;
                if (!this.cancelRequest) {

                  if (queryResults) {
                    var sr = this._map.spatialReference;
                    var fs = [];
                    for (var i = 0; i < queryResults.length; i++) {
                      for (var ii = 0; ii < queryResults[i][1].features.length; ii++) {
                        var item = queryResults[i][1].features[ii];
                        if (typeof (item.geometry) !== 'undefined') {
                          var geom = new Point(item.geometry.x, item.geometry.y, sr);
                          var gra = new Graphic(geom);
                          gra.setAttributes(item.attributes);
                          if (this.infoTemplate) {
                            gra.setInfoTemplate(this.infoTemplate);
                          }
                          fs.push(gra);
                        }
                      }
                    }

                    //TODO...figure out a better test here JSON.stringify does not like itwhen you have too many features
                    //it fell over with 150,000 for sure have not really tested it out too far
                    var shouldUpdate = true;
                    if (fs < 10000) {
                      shouldUpdate = JSON.stringify(this._features) !== JSON.stringify(fs);
                    }
                    if (shouldUpdate) {
                      this._features = fs;
                      this.clusterFeatures();
                    }

                    this.loaded = true;
                  }
                } else {
                  console.log("Cancelled ClusterLayer 2");
                }
              }));
            } else {
              console.log("Cancelled ClusterLayer 1");
            }
          }
        }));
      }
    },

    //click
    handleClick: function (event) {
      var singles = [];

      if (event.graphic) {
        var g = event.graphic;
        if (g.attributes) {
          var attr = g.attributes;
          if (attr.Data) {
            this.clearSingles(this._singles);
            singles = attr.Data
            event.stopPropagation();
            this._addSingles(singles);
            this._map.infoWindow.setFeatures(attr.Data);
          } else {
            this._map.infoWindow.setFeatures([g]);
          }
        }
      }

      this._map.infoWindow.show(event.mapPoint);
      //this._map.infoWindow.maximize();
      dojoEvent.stop(event);
    },

    //re-cluster on extent change
    handleMapExtentChange: function (event) {
      if (event.levelChange) {
        this.clusterFeatures();
      } else if (event.delta) {
        var delta = event.delta;
        var dx = Math.abs(delta.x);
        var dy = Math.abs(delta.y);
        if (dx > 50 || dy > 50)
          this.clusterFeatures();
      }
    },

    refreshFeatures: function () {
      if (this.itemId) {
        arcgisUtils.getItem(this.itemId).then(lang.hitch(this, function (response) {
          var fcItemInfo = response.item;
          var featureCollection = response.itemData;
          var fcLayer;
          for (var i = 0; i < featureCollection.layers.length; i++) {
            var fcl = featureCollection.layers[i];
            if (fcl.layerDefinition.name === this._parentLayer.name) {
              fcLayer = fcl;
              break;
            }
          }
          var fs = fcLayer.featureSet.features;
          var shouldUpdate = true;
          if (fs.length < 10000) {
            //shouldUpdate = JSON.stringify(this._features) !== JSON.stringify(fs);
          }

          if (shouldUpdate) {
            //if valid response then clear and load
            this._features = [];

            //TODO is this right or should I use the items SR
            var sr = this._map.spatialReference;

            for (var i = 0; i < fs.length; i++) {
              var item = fs[i];
              if (item.geometry) {
                this._features.push({
                  geometry: new Point(item.geometry.x, item.geometry.y, item.geometry.spatialReference),
                  attributes: item.attributes
                });
              } else {
                console.log("Null geometry skipped");
              }
            }
            this.clusterFeatures();
          }
        }));
      } else if (this.url) {
        this.loadData(this.url);
      }
    },

    flashFeatures: function () {
      this.flashGraphics(this.graphics);
      //var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, this.color, 7);
      //var cls2 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, this.color, 3);

      //var cls4 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
      //var x = 0;

      //clearInterval(this.s);

      //this.s = setInterval(lang.hitch(this, function () {
      //  for (var i = 0; i < this.graphics.length; i++) {
      //    var g = this.graphics[i];
      //    if (x % 2) {
      //      var s = g.symbol;
      //      if (typeof (s.setOutline) === 'function') {
      //        s.setOutline(cls)
      //      }
      //      g.setSymbol(s);
      //    } else {
      //      var s = g.symbol;
      //      if (typeof (s.setOutline) === 'function') {
      //        s.setOutline(cls2)
      //      }
      //      g.setSymbol(s);
      //    }
      //  }
      //  this.redraw();
      //  x = x + 1;
      //  if (x == 5) {
      //    clearInterval(this.s);
      //    for (var i = 0; i < this.graphics.length; i++) {
      //      var g = this.graphics[i];
      //      var s = g.symbol;
      //      if (typeof (s.setOutline) === 'function') {
      //        s.setOutline(cls4)
      //      }
      //      g.setSymbol(s);
      //    }
      //    this.redraw();
      //  }
      //}), 600);
    },

    flashSingle: function (graphic) {
      if (typeof (graphic.symbol) === 'undefined') {
        var cls2 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
        var symColor = this.color.toRgb();
        graphic.setSymbol(new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 9, cls2, new Color([symColor[0], symColor[1], symColor[2], 0.5])));
      }
      this.flashGraphics([graphic]);
    },

    flashGraphics: function (graphics) {
      var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, this.color, 7);
      var cls2 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, this.color, 3);

      var cls4 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
      var x = 0;

      clearInterval(this.s);

      this.s = setInterval(lang.hitch(this, function () {
        for (var i = 0; i < graphics.length; i++) {
          var g = graphics[i];
          if (x % 2) {
            var s = g.symbol;
            if (s) {
              if (typeof (s.setOutline) === 'function') {
                s.setOutline(cls)
              }
              g.setSymbol(s);
            }
          } else {
            var s = g.symbol;
            if (s) {
              if (typeof (s.setOutline) === 'function') {
                s.setOutline(cls2)
              }
              g.setSymbol(s);
            }
          }
        }
        this.redraw();
        x = x + 1;
        if (x == 5) {
          clearInterval(this.s);
          for (var i = 0; i < graphics.length; i++) {
            var g = graphics[i];
            var s = g.symbol;
            if (typeof (s) !== 'undefined') {
              if (typeof (s.setOutline) === 'function') {
                s.setOutline(cls4)
              }
              g.setSymbol(s);
            }
          }
          this.redraw();
          //TODO handle in a better way
          this.clusterFeatures();
        }
      }), 600);
    },

    //set color
    setColor: function (color) {
      this.color = Color.fromString(color);

      //var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
      //this._singleSym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 9, cls, new Color([this.color[0], this.color[1], this.color[2], 0.5]));
    },

    cancelPendingRequests: function () {
      console.log("Cancel Query...");
      if (this.queryPending) {
        this.cancelRequest = true;
      }
      this.removeEventListeners();
    },

    removeEventListeners: function () {
      if (this.extentChangeSignal) {
        this.extentChangeSignal.remove();
        this.extentChangeSignal = null;
      }
      if (this.clickSignal) {
        this.clickSignal.remove();
        this.clickSignal = null;
      }
    },

    // cluster features
    clusterFeatures: function (redraw) {
      this.clear();
      if (this._map.infoWindow.isShowing)
        this._map.infoWindow.hide();
      var features = this._features;
      var total = 0;
      if (typeof (features) === 'string') {
        this.setFeatures(features);
      } else if (typeof (features) !== 'undefined') {
        if (features.length > 0) {

          var clusterSize = this.clusterSize;
          this.clusterGraphics = new Array();
          var sr = this._map.spatialReference;
          var mapExt = this._map.extent;
          var o = new Point(mapExt.xmin, mapExt.ymax, sr);

          var rows = Math.ceil(this._map.height / clusterSize);
          var cols = Math.ceil(this._map.width / clusterSize);
          var distX = mapExt.getWidth() / this._map.width * clusterSize;
          var distY = mapExt.getHeight() / this._map.height * clusterSize;

          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
              var x1 = o.x + (distX * c);
              var y2 = o.y - (distY * r);
              var x2 = x1 + distX;
              var y1 = y2 - distY;

              var ext = new Extent(x1, y1, x2, y2, sr);

              var cGraphics = new Array();
              for (var i in features) {
                var feature = features[i];
                if (ext.contains(feature.geometry)) {
                  total += 1;
                  cGraphics.push(feature);
                }
              }
              if (cGraphics.length > 0) {
                var cPt = this.getClusterCenter(cGraphics);
                this.clusterGraphics.push({
                  center: cPt,
                  graphics: cGraphics
                });
              }
            }
          }

          //add cluster to map
          for (var g in this.clusterGraphics) {
            var clusterGraphic = this.clusterGraphics[g];
            var count = clusterGraphic.graphics.length;
            var data = clusterGraphic.graphics;
            var size = 40 + parseInt(count / 40);
            var size2 = size - (size / 4);

            this._setSymbols(size, size2);

            var attr = {
              Count: count,
              Data: data
            };
            if (count > 1) {
              if (typeof (this.symbolData) !== 'undefined') {
                if (this.symbolData.symbolType !== 'CustomSymbol') {
                  this.add(new Graphic(clusterGraphic.center, this.csym, attr));
                  this.add(new Graphic(clusterGraphic.center, this.csym3, attr));
                  //this.add(new Graphic(clusterGraphic.center, new PictureMarkerSymbol(this.symbolData.s, 13, 13), attr));
                } else {
                  this.add(new Graphic(clusterGraphic.center, this.csym, attr));
                  this.add(new Graphic(clusterGraphic.center, this.psym, attr));
                  //this.add(new Graphic(clusterGraphic.center, new PictureMarkerSymbol(this.symbolData.s, 13, 13), attr));
                }
              } else {
                this.add(new Graphic(clusterGraphic.center, this.csym, attr));
                this.add(new Graphic(clusterGraphic.center, this.psym, attr));
                //this.add(new Graphic(clusterGraphic.center, new PictureMarkerSymbol(this.symbolData.s, 13, 13), attr));
              }
            } else {
              ////TODO look to see if this could be consolidated further
              //var pt = clusterGraphic.graphics[0].geometry;
              //if (typeof (this.symbolData) !== 'undefined') {
              //  if (this.symbolData.symbolType !== 'CustomSymbol') {
              //    this.add(new Graphic(pt, this.csym2, attr));
              //  } else {
              //    this.add(new Graphic(pt, this.csym2, attr));
              //    this.add(new Graphic(pt, this.psym2, attr));
              //  }
              //} else {
              //  this.add(new Graphic(pt, this.csym2, attr));
              //  this.add(new Graphic(pt, this.psym2, attr));
              //}

              //TODO look to see if this could be consolidated further
              var pt = clusterGraphic.graphics[0].geometry;
              //if (typeof (this.symbolData) !== 'undefined') {
              //  if (this.symbolData.symbolType !== 'CustomSymbol') {
              //    this.add(new Graphic(pt, this.csym2, attr));
              //  } else {
              //    this.add(new Graphic(pt, this.csym2, attr));
              //    this.add(new Graphic(pt, this.psym2, attr));
              //  }
              //} else {
              //  this.add(new Graphic(pt, this.csym2, attr));
              //  this.add(new Graphic(pt, this.psym2, attr));
              //}
              
              //this.add(new Graphic(pt, jsonUtils.fromJson(this.firstRenderSymbol), attr));

              //this.add(new Graphic(pt, this.csym2, attr));
              ////this.add(new Graphic(pt, this.psym2, attr));
              //this.add(new Graphic(pt, jsonUtils.fromJson(this.firstRenderSymbol), attr));
              if (this.renderer.hasOwnProperty("getSymbol") && this.symbolData.symbolType === "LayerSymbol") {
                //TODO...this idea could be great to show the individuals with their actual symbol if this logic makes sense...
               // this.add(new Graphic(pt, this.csym2, attr));
                var ggg = new Graphic(pt, null, attr.Data[0].attributes);
                var symmmm = this.renderer.getSymbol(ggg);
                ggg.setSymbol(symmmm);
                this.add(ggg);
              } else if (this.renderer.hasOwnProperty("symbol") && this.symbolData.symbolType === "LayerSymbol") {
                this.add(new Graphic(pt, jsonUtils.fromJson(this.renderer.symbol), attr));
              }else if (this.symbolData.symbolType === "EsriSymbol") {
                this.add(new Graphic(pt, jsonUtils.fromJson(this.symbolData.symbol), attr));
              } else if (this.symbolData.symbolType !== "LayerSymbol") {
                this.add(new Graphic(pt, this.psym, attr));
              } else {
                  //this.add(new Graphic(pt, new PictureMarkerSymbol(this.renderer.symbol.imageData, this.renderer.symbol.width, this.renderer.symbol.height), attr));
                  //this.add(new Graphic(pt, new PictureMarkerSymbol(this.symbolData.s, 13, 13), attr));
                  this.add(new Graphic(pt, this.psym, attr));
                
                //this.add(new Graphic(pt, this.csym2, attr));

                //this.psym = new PictureMarkerSymbol(this.icon, size - 11, size - 11);
                //this.add(new Graphic(pt, new PictureMarkerSymbol(this.renderer.symbol.imageData, this.renderer.symbol.width, this.renderer.symbol.height), attr));
              }
            }
          }
        }

        if (this.node) {
          this.node.innerHTML = total;
        }
      }
    },

    _setSymbols: function (size, size2) {
      var symColor = this.color.toRgb();
      if (typeof (this.symbolData) !== 'undefined') {
        var c;
        //need to make a marker from the fill properties
        if (this.backgroundClusterSymbol === "custom") {
          //this.tcm.updateUI(this.tcm._styleColor);
          //this.colors = this.tcm._getC();
          //var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
          //symColor = this.tcm.hexToRgb(this.colors[this.idx]);
          //this._singleSym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 9, cls, new Color([symColor[0], symColor[1], symColor[2], 0.75]));
          c = symColor;
        } else {

          var fsp = jsonUtils.fromJson(this.backgroundClusterSymbol);
          var style;
          var lineWidth;
          if (fsp.outline.color.a === 0) {
            style = SimpleLineSymbol.STYLE_NULL;
            lineWidth = 0;
          } else {
            style = SimpleLineSymbol.STYLE_SOLID;
            lineWidth = fsp.outline.width;
          }
          var cls = SimpleLineSymbol(style, fsp.outline.color, lineWidth);
          c = fsp.color.toRgb();
        }

        this.csym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, size, cls, new Color([c[0], c[1], c[2], 0.75]));
        //this.psym = new PictureMarkerSymbol(this.icon, size - 11, size - 11);
        var path = this.symbolData.s;
        if(path.indexOf("${appPath}") > -1){
          path = this.symbolData.s.replace("${appPath}", window.location.origin + window.location.pathname);
        } else if (this.symbolData.s) {
          path = this.symbolData.s;
        } else {
          path = this.symbolData.icon.imageData;
        }
        if (path && this.symbolData.iconType === "CustomIcon") {
          //THIS WORKS UNLESS A CUSTOM ICON IS USED//
          this.psym = new PictureMarkerSymbol(path, size - 11, size - 11);
          //this.psym = jsonUtils.fromJson(this.symbolData.symbol);

          //this.psym = this.symbolData.symbol;
        } else if (path && this.symbolData.iconType === "LayerIcon") {
          this.psym = jsonUtils.fromJson(this.symbolData.symbol);
        }else {
          var ssssssss = SimpleLineSymbol(this.symbolData.icon.outline.style, this.symbolData.icon.outline.color, this.symbolData.icon.outline.width);
          this.psym = new SimpleMarkerSymbol(this.symbolData.icon.style, this.symbolData.icon.size, ssssssss, this.symbolData.icon.color);
          //this.psym = jsonUtils.fromJson(this.symbolData.icon);
          //this.psym = this.symbolData.symbol;
        }

        //options for cluster with 1
        this.csym2 = lang.clone(this.psym);
        this.csym3 = lang.clone(this.csym2);
        if (typeof (this.csym2.xoffset) !== 'undefined') {
          this.csym3.xoffset = 0;
        }
        if (typeof (this.csym2.yoffset) !== 'undefined') {
          this.csym3.yoffset = 0;
        }
      } else {
        //options for cluster with more than 1
        var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
        this.csym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, size, cls, new Color([symColor[0], symColor[1], symColor[2], 0.5]));
        this.psym = new PictureMarkerSymbol(this.icon.url, size - 11, size - 11);

        //options for cluster with 1
        this.psym2 = new PictureMarkerSymbol(this.icon.url, size2 - 13, size2 - 13);
        //this.psym2 = jsonUtils.fromJson(this.renderer.symbol)
        var cls2 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
        this.csym2 = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, size2, cls2, new Color([symColor[0], symColor[1], symColor[2], 0.5]));
      }
    },

    _setupSymbols: function () {
      if (typeof (this.symbolData) !== 'undefined') {
        //this.mainSymbol = this.symbolData.symbol;
        this.mainSymbol = this.icon;
        //if (this.renderSymbols.length > 0) {
        //  this.firstRenderSymbol = this.renderSymbols[this.renderSymbols.length -1];
        //} else {
        //  this.firstRenderSymbol = this.mainSymbol;
        //}
        if (this.renderer) {
          this.firstRenderSymbol = this.renderer.symbol;
        }
        this.backgroundClusterSymbol = this.symbolData.clusterSymbol;
        if (this.backgroundClusterSymbol === "custom") {

          //TODO create a symbol with  the theme color
        //  this.tcm.updateUI();
        //  this.colors = this.tcm._getC();
        }
      }
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

    //SymbolsORG: function(){
    //  var symColor = this.color.toRgb();
    //  var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
    //  var csym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, size, cls, new Color([symColor[0], symColor[1], symColor[2], 0.5]));
    //  var psym = new PictureMarkerSymbol(this.icon, size - 11, size - 11);
    //  var psym2 = new PictureMarkerSymbol(this.icon, size2 - 13, size2 - 13);
    //  var cls2 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
    //  var csym2 = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, size2, cls2, new Color([symColor[0], symColor[1], symColor[2], 0.5]));

    //},

    getClusterCenter: function (graphics) {
      var xSum = 0;
      var ySum = 0;
      var count = graphics.length;
      array.forEach(graphics, function (graphic) {
        xSum += graphic.geometry.x;
        ySum += graphic.geometry.y;
      }, this);
      var cPt = new Point(xSum / count, ySum / count, graphics[0].geometry.spatialReference);
      return cPt;
    }
  });

  return clusterLayer;
});
