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
   'esri/layers/FeatureLayer',
   'esri/graphic',
   'esri/SpatialReference',
   'esri/geometry/Extent',
   'esri/request',
   'esri/tasks/query',
   'esri/tasks/QueryTask',
   'esri/symbols/SimpleLineSymbol',
   'esri/renderers/SimpleRenderer',
   "esri/arcgis/utils"
],

function (declare, array, dojoEvent, lang, Color, on, DeferredList,
  FeatureLayer, Graphic, SpatialReference, Extent, esriRequest, Query, QueryTask, SimpleLineSymbol, SimpleRenderer, arcgisUtils) {
  var dataLoader = declare(null, {
    //Loads data from parent layers url or itemID to a layer instance
    // handles updating of the counter node in the widgets panel for this item

    _parentLayer: null,
    _parentLayerObject: null,
    _url: "",
    _geometryType: "",
    _map: null,
    _infoTemplate: null,
    _id: "",
    _fieldNames: [],
    _symbolField: "",
    _lyrInfo: null,
    _refreshEnabled: false,
    _renderer: null,
    _symbolField: "",
    loaded: false,
    _lyrType: "",
    name: "",
    _node: null,
    symbolData: null,

    mapClickSignal: null,
    extentChangeSignal: null,

    mapLayer: null,

    testCount: 0,
    cancelRequest: false,
    p: null,

    //options: {
    //parentLayer: <source layer>, 
    //map: <map>, 
    //id: <"NewLayerID">, 
    //name: <"User Defined Label from settings">
    //node: <updateNode>, 
    //lyrInfo: <lyrInfo for the source layer>,
    //refreshEnabled: <bool>
    //features: <optional if url is supplied>
    //}
    constructor: function (options) {
      //looping through subLayers should already been done expects the actual layerObject
      this._parentLayer = options.parentLayer;
      if (typeof (options.mapServiceResults) !== 'undefined') {
        this._parentLayerObject = options.mapServiceResults;
      } else {
        this._parentLayerObject = this._parentLayer.layerObject;
      }
      this._map = options.map;
      this._id = options.id;
      this._node = options.node;
      this._lyrInfo = options.layerInfo;
      this._refreshEnabled = options.refreshEnabled;
      this._features = options.features;
      this._lyrType = options.layerType;
      this.p = options.parent;
      this.filter = options.filter;
      this._url = this._lyrInfo.url;
      this._renderer = this._parentLayerObject.renderer;
      this._geometryType = this._parentLayerObject.geometryType;
      this.symbolData = options.symbolData;
      this.itemId = options.itemId;
      this.renderer = options.renderer;
      this.geometryType = options.geometryType;
      this.drawingInfo = options.drawingInfo;

      if (this._renderer) {
        if (typeof (this._renderer.attributeField) !== "undefined") {
          //TODO...this should actually be a collection...could be more than one
          this._symbolField = this._renderer.attributeField;
        }
      }

      this._infoTemplate = this._parentLayerObject.infoTemplate;

      //TODO May be better to check and do this loop in settings also
      if (!this._infoTemplate) {
        if(typeof(this._parentLayer.originOperLayer) !== 'undefined'){
          if (typeof (this._parentLayer.originOperLayer.parentLayerInfo) !== 'undefined') {
            if (typeof (this._parentLayer.originOperLayer.parentLayerInfo.controlPopupInfo) !== 'undefined') {
              var popupInfos = this._parentLayer.originOperLayer.parentLayerInfo.controlPopupInfo.infoTemplates;
              var url = this._parentLayerObject.url;
              var index = url.substr(url.lastIndexOf('/') + 1);
              if (popupInfos.hasOwnProperty(index)) {
                this._infoTemplate = popupInfos[index].infoTemplate;
              }
            }
          }
        }   
      }

      this._fieldNames = [];
      this.getFieldNames();

      if (this._parentLayer.layerType !== "ArcGISStreamLayer") {
        this.createMapLayer();
      }

      //not sure if I'll do this route...this would load the data 
      //directly from the parent collection...
      //TODO check how the layer type handles larger collections of features
      //When I tried to export a FL with 150,000 features to a FC it fell over so not sure 
      // if the inital FC layer could have a partial collection of the data initally
      //if it's gaurenteed to have all the this would definelty load faster
      if (typeof (this._features) === 'undefined' && this._parentLayer.layerType !== "ArcGISStreamLayer") {
        if (typeof (this._url) !== 'undefined') {
          this.loadData(this._url);
          this.extentChangeSignal = this._map.on('extent-change', lang.hitch(this, this.countFeatures));
          this.countFeatures();
        } else {
          this.loaded = "error";
          //this.removeEventListeners();
        }
      } else if (this._parentLayer.layerType === "ArcGISStreamLayer") {
        this.mapLayer = this._parentLayerObject;
        this.mapLayer.on('update-end', lang.hitch(this, function () {
          this.countFeatures();
        }));

      } else {
        this.loadDataFromFeatureCollection();

        //TODO need to find a better way to deal with deep objects
        //JSON.stringify falls over pretty quickly
        //var shouldUpdate = true;
        //if (this._features < 10000) {
        //    shouldUpdate = JSON.stringify(this._features) !== JSON.stringify(fs);
        //}
        //if (shouldUpdate) {
        //    this.graphics = fs;
        this.countFeatures();
        //}

        this.loaded = true;
        this.extentChangeSignal = this._map.on('extent-change', lang.hitch(this, this.countFeatures));
      }
    },

    cancelPendingRequests: function () {
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
    },

    getFieldNames: function () {
      //this will limit the fields to those fequired for the popup
      if (this._infoTemplate) {
        if (typeof (this._infoTemplate.info) !== 'undefined') {
          var fieldInfos = this._infoTemplate.info.fieldInfos;
          for (var i = 0; i < fieldInfos.length; i++) {
            if (fieldInfos[i].visible) {
              this._fieldNames.push(fieldInfos[i].fieldName);
            }
          }
        }
        if (this._symbolField) {
          if (this._fieldNames.length > 0) {
            if (this._fieldNames.indexOf(this._symbolField) === -1) {
              this._fieldNames.push(this._symbolField);
            }
          }
        }
      }
      if (this._fieldNames.length < 1) {
        //get all fields
        this._fieldNames = ["*"]
      }
    },

    loadDataFromFeatureCollection: function () {
      //load inital data fromFeatureCollection layer in the map
      //TODO need to be able to filter at this level also
      this.mapLayer.clear();
      var sr = this._map.spatialReference;
      for (var i = 0; i < this._features.length; i++) {
        var item = this._features[i];
        if (typeof (item.geometry) !== 'undefined') {
          var gra = new Graphic(this.getGraphicOptions(item, sr));
          gra.setAttributes(item.attributes);
          if (this._infoTemplate) {
            gra.setInfoTemplate(this._infoTemplate);
          }
          this.mapLayer.add(gra);
        }
      }
    },

    initalCount: function (url) {
      var q = new Query();
      q.returnGeometry = false;
      q.geometry = this._map.extent;
      var qt = new QueryTask(url);
      qt.executeForCount(q).then(lang.hitch(this, function (cnt) {
        if (this._node) {
          this._node.innerHTML = cnt;
        }
      }));
    },

    loadData: function (url) {
      if (url.length > 0) {
        //get a quick inital count while the graphics are being retrieved
        this.initalCount(url);
        var q = new Query();
        q.where = typeof (this.filter) !== 'undefined' ? this.filter.expr : "1=1";
        q.returnGeometry = false;
        this.queryPending = true;
        var qt = new QueryTask(url);
        qt.executeForIds(q).then(lang.hitch(this, function (results) {
          var max = 1000;
          if (results) {
            var queries = [];
            var i, j;
            for (i = 0, j = results.length; i < j; i += max) {
              var ids = results.slice(i, i + max);
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
                if (queryResults) {
                  var sr = this._map.spatialReference;
                  var fs = [];
                  this.mapLayer.clear();
                  for (var i = 0; i < queryResults.length; i++) {
                    if (typeof (queryResults[i][1].features) !== 'undefined') {
                      for (var ii = 0; ii < queryResults[i][1].features.length; ii++) {
                        var item = queryResults[i][1].features[ii];
                        if (typeof (item.geometry) !== 'undefined') {
                          var gra = new Graphic(this.getGraphicOptions(item, sr));
                          gra.setAttributes(item.attributes);
                          if (this._infoTemplate) {
                            gra.setInfoTemplate(this._infoTemplate);
                          }

                          this.mapLayer.add(gra);
                          this._features.push(item);
                        }
                      }
                    }
                  }

                  //if (JSON.stringify(this._features) !== JSON.stringify(fs)) {
                  //this.graphics = fs;
                  this.countFeatures();
                  //}

                  this.loaded = true;
                  
                  //TODO should handle this properly and try to re-initate the 
                  //the query if we can tell what's wrong
                  //else {
                  //  if(typeof(queryResults[0][1].details) !== 'undefined'){
                  //    for (var ii = 0; ii < length; ii++) {
                  //      console.log("Query failed: " + queryResults[0][1].details[ii]);
                  //    }      
                  //  }
                  //}
                }
              }));
            } else {
              console.log("Cancelled");
            }
          }
        }));
      }
    },

    getGraphicOptions: function (item, sr) {
      var graphicOptions;
      if (typeof (item.geometry.rings) !== 'undefined') {
        graphicOptions = {
          geometry: {
            rings: item.geometry.rings,
            "spatialReference": { "wkid": sr.wkid }
          }
        }
      } else if (typeof (item.geometry.paths) !== 'undefined') {
        graphicOptions = {
          geometry: {
            paths: item.geometry.paths,
            "spatialReference": { "wkid": sr.wkid }
          }
        }
      } else {
        graphicOptions = {
          geometry: { 
            x: item.geometry.x,
            y: item.geometry.y,
            "spatialReference": { "wkid": sr.wkid }
          },
          symbol: this.renderer.symbol
        }
      }
      return graphicOptions;
    },

    createMapLayer: function () {
      //create the layer instance 

      //TODO find a better way to handle this
      if (this._map.graphicsLayerIds.indexOf(this._id) > -1) {
        this._map.removeLayer(this._map.getLayer(this._id));
      }

      var layerDef = null;
      if (this._lyrType === "Feature Collection") {
        layerDef = {
          "geometryType": this._geometryType,
          "objectIdField": this._parentLayer.layerDefinition.objectIdField,
          "fields": this._parentLayer.layerDefinition.fields,
          "drawingInfo": this._parentLayer.layerDefinition.drawingInfo
        };
      } else {
        //default info from parent layer should be used
        // to set options for other standard Feature Layers as well
        var drawingInfo = undefined;
        var test = false;
        if (this._parentLayer.resourceInfo) {
          drawingInfo = this._parentLayer.resourceInfo.drawingInfo;
        } else if (this._parentLayerObject.drawingInfo) {
          drawingInfo = this._parentLayerObject.drawingInfo;
        } else if (this._lyrInfo.drawingInfo) {
          drawingInfo = this._lyrInfo.drawingInfo;
          test = true;
        }
        if (test) {
          //TODO should set this earlier now that it's saved with layerInfo from settings
          this._geometryType = this._lyrInfo.geometryType;
          layerDef = {
            "geometryType": this._lyrInfo.geometryType,
            "objectIdField": this._lyrInfo.oidFieldName,
            "fields": this._lyrInfo.fields,
            "drawingInfo": drawingInfo
          };
        } else {
          layerDef = {
            "geometryType": this._geometryType,
            "objectIdField": this._parentLayerObject.objectIdField,
            "fields": this._parentLayerObject.fields,
            "drawingInfo": drawingInfo
          };
        }
      }

      this.mapLayer = new FeatureLayer({
        "layerDefinition": layerDef,
        "featureSet": {
          "features": [],
          "geometryType": this._geometryType,
          "spatialReference": this._map.spatialReference.wkid
        }
      }, {
        id: this._id,
        name: this.name,
        infoTemplate: this._infoTemplate
      });

      //TODO need to check if a custom symbol has been defined for this
      if (this.symbolData) {
        if (this.symbolData.symbolType !== 'LayerSymbol') {
          this._renderer = new SimpleRenderer({
            "type": "simple",
            "label": "",
            "description": "",
            "symbol": this.symbolData.symbol
          });
        }
      }
      if (this._renderer) {
        this.mapLayer.setRenderer(this._renderer);
      }
      else if (this.renderer && typeof (this.mapLayer.renderer) === 'undefined') {
        this.mapLayer.setRenderer(this.renderer);
      }
    },

    refreshFeatures: function (url) {
      //TODO need to use the configured symbol if one is there

      if (this.itemId) {
        arcgisUtils.getItem(this.itemId).then(lang.hitch(this, function (response) {
          var fcItemInfo = response.item;
          var featureCollection = response.itemData;
          //TODO only do this if the json has changed

          //TODO...need to get the correct layer(s)
          //Loop through and compare by ID or ID an <X> combination
          var fs = featureCollection.layers[0].featureSet.features;

          var shouldUpdate = true;
          if (fs.length < 10000) {
            shouldUpdate = JSON.stringify(this._features) !== JSON.stringify(fs);
            alert("stringify says: " + shouldUpdate);
          }

          if (shouldUpdate) {
            //if valid response then clear and load
            this._features = [];
            this.mapLayer.clear();
            //TODO is this right or should I use the items SR
            var sr = this._map.spatialReference;

            for (var i = 0; i < fs.length; i++) {
              var graphicOptions = null;
              var item = fs[i];
              var gra = new Graphic(this.getGraphicOptions(item, sr));
              gra.setAttributes(item.attributes);
              if (this._infoTemplate) {
                gra.setInfoTemplate(this._infoTemplate);
              }
              this.mapLayer.add(gra);
              this._features.push(item);
            }
            this.countFeatures();
          }
          }));
        } else {
        if (url) {
          this.loadData(url);
        } else if (this._url) {
          this.loadData(this._url);
        }
      } 
    },

    flashFeatures: function () {
      //var cls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 0, 0]), 10);
      //var cls2 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 255, 0]), 5);
      //var cls3 = new SimpleLineSymbol(SimpleLineSymbol.STYLE_NULL, new Color(0, 0, 0, 0), 0);
      //var x = 0;

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
      //      s.setOutline(cls3)
      //      g.setSymbol(s);
      //    }
      //    this.redraw();
      //  }
      //}), 500);
    },

    countFeatures: function (event) {
      var q = new Query();
      q.geometry = this._map.extent;
      this.mapLayer.queryCount(q, lang.hitch(this, function (r) {
        if (this._node) {
          this._node.innerHTML = r;
        }
      }));
    }
  });

  return dataLoader;
});
