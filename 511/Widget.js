///////////////////////////////////////////////////////////////////////////
// Copyright 2015 Esri. All Rights Reserved.
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

define(['jimu/BaseWidget',
'jimu/LayerInfos/LayerInfos',
'jimu/utils',
'dojo/dom',
'dojo/dom-class',
'dojo/dom-construct',
'dojo/on',
'dojo/dom-style',
'dojo/_base/declare',
'dojo/_base/lang',
'dojo/_base/html',
'dojo/promise/all',
'dojo/_base/array',
'dijit/_WidgetsInTemplateMixin',
'esri/graphic',
'esri/geometry/Point',
'esri/dijit/Legend',
'esri/tasks/query',
'esri/tasks/QueryTask',
"esri/arcgis/utils",
'esri/symbols/jsonUtils',
"esri/renderers/SimpleRenderer",
'./js/ClusterLayer',
'./js/ThemeColorManager',
'./js/LayerVisibilityManager',
"dijit/registry",
'dojox/gfx'
],
function (BaseWidget,
  LayerInfos,
  utils,
  dom,
  domClass,
  domConstruct,
  on,
  domStyle,
  declare,
  lang,
  html,
  all,
  array,
  _WidgetsInTemplateMixin,
  Graphic,
  Point,
  Legend,
  Query,
  QueryTask,
  arcgisUtils,
  jsonUtils,
  SimpleRenderer,
  ClusterLayer,
  ThemeColorManager,
  LayerVisibilityManager,
  registry,
  gfx
  ) {
  return declare([BaseWidget, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-511',

    name: "511",
    opLayers: null,
    opLayerInfos: null,
    layerList: {},
    UNIQUE_APPEND_VAL_CL: "_CL",
    widgetChange: false,
    layerVisibilityManager: null,
    refreshInterval: null,
    queries: [],
    queryLayers: [],
    configLayerInfos: [],
    streamLayers: [],
    queryLookupList: [],
    w: null,
    legendNodes: [],
    currentClusterLayer: null,
    currentQueryList: [],
    rendererChanges: [],

    postCreate: function () {
      this.inherited(arguments);
      this.configLayerInfos = this.config.layerInfos;
      this.queryLookupList = [];
      this.layerList = {};
      //populates this.opLayers from this.map and creates the panel
      this._initWidget();
    },

    startup: function () {
      this.inherited(arguments);
      this.mapExtentChangedHandler = this.own(on(this.map, "extent-change", lang.hitch(this, this._mapExtentChange)));
      this._mapExtentChange();
    },

    onOpen: function () {
      this.widgetChange = false;

      if (!this.mapExtentChangedHandler) {
        this.mapExtentChangedHandler = this.own(on(this.map, "extent-change", lang.hitch(this, this._mapExtentChange)));
        this._mapExtentChange();
      }

      ////helps turn on/off layers when the widget is opened and closed
      this.layerVisibilityManager = new LayerVisibilityManager({
        map: this.map,
        configLayerList: this.layerList,
        parent: this
      });

      this.w = this;

      //if refresh is enabled set refereshInterval on all widget source layers
      //and call setInterval to refresh the static graphics in the cluster layers
      if (this.config.refreshEnabled) {
        this.enableRefresh();
      }

      this.layerVisibilityManager.setLayerVisibility(this.layerList, false);
      this.map.infoWindow.highlight = true;
    },

    enableRefresh: function () {
      //set refreshItereval on all widget source layers that support it
      var lyr = null;
      var checkedTime = false;
      for (var key in this.layerList) {
        lyr = this.layerList[key];
        if (lyr.type !== "ClusterLayer") {
          if (!checkedTime && lyr.li) {
            if (lyr.li.itemId) {
              arcgisUtils.getItem(lyr.li.itemId).then(lang.hitch(this, this._updateItem));
              checkedTime = true;
            }
          }

          lyr = lyr.layerObject;
        } else {
          var id;
          if (lyr.li) {
            id = lyr.li.id;
          } else if (lyr.id) {
            id = lyr.id;
          }

          for (var i = 0; i < this.opLayers.length; i++) {
            var l = this.opLayers[i];
            if (l.layerObject) {
              lyr = l.layerObject;
              break;
            }
          }
        }
        if (lyr) {
          //TODO
          if (typeof (lyr.refreshInterval) !== 'undefined') {
            lyr.refreshInterval = this.config.refreshInterval;
          }
        }
      }

      //refresh the cluster layers at the same interval
      //TODO only need to reset this if the value has changed
      if (typeof(this.refreshInterval) === 'undefined') {
        this.refreshInterval = setInterval(lang.hitch(this, this.refreshLayers), (this.config.refreshInterval * 60000));
      }
    },

    _updatePanelTime: function (modifiedTime) {
      var dFormat = {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      this.pageTitle.innerHTML = "<div></div>";
      var updateValue = "";
      if (this.config.mainPanelText !== "") {
        updateValue = this.config.mainPanelText + " ";
      }

      this.pageTitle.innerHTML = updateValue + new Date(modifiedTime).toLocaleDateString(navigator.language, dFormat);
    },

    refreshLayers: function () {
      //TODO...need to create a current query list...to avoid duplicate queries to the same itemID for sub layers
      for (var key in this.layerList) {
        var lyr = this.layerList[key];
        if (lyr.type === "ClusterLayer") {
          lyr.layerObject.refreshFeatures();
        } else if (lyr.li.itemId) {
          //TODO need to know if it's a FC...that is what we are expecting here
          if (this.currentQueryList.indexOf(lyr.li.itemId) === -1) {
            this.currentQueryList.push(lyr.li.itemId);
            arcgisUtils.getItem(lyr.li.itemId).then(lang.hitch(this, this._updateItem));
          }
        }
      }
    },

    _updateItem: function(response) {
      var fcItemInfo = response.item;

      this._updatePanelTime(fcItemInfo.modified);

      var featureCollection = response.itemData;
      var fcLayer;
      var lyr;
      featureCollectionLoop:
        for (var i = 0; i < featureCollection.layers.length; i++) {
          var fcl = featureCollection.layers[i];
          layerListLoop:
            for (var k in this.layerList) {
              if (this.layerList[k].pl) {
                if (this.layerList[k].pl.layerDefinition.name === fcl.layerDefinition.name) {
                  lyr = this.layerList[k];
                  break layerListLoop;
                }
              }
            }

          //TODO this test needs to be updated for the Pre-generated
          if (fcl.layerDefinition.name === lyr.pl.layerDefinition.name) {
            fcLayer = fcl;
            if (fcLayer) {
              var fs = fcLayer.featureSet.features;
              var shouldUpdate = true;
              if (fs.length < 10000) {
                shouldUpdate = JSON.stringify(this._features) !== JSON.stringify(fs);
              }

              if (shouldUpdate) {
                lyr.layerObject.clear();
                //TODO is this right or should I use the items SR
                var sr = this.map.spatialReference;

                for (var j = 0; j < fs.length; j++) {
                  //var graphicOptions = null;
                  var item = fs[j];
                  if (item.geometry) {
                    //check li for renderer also
                    var gra = new Graphic(this.getGraphicOptions(item, sr, lyr.layerObject.renderer));
                    gra.setAttributes(item.attributes);
                    if (this._infoTemplate) {
                      gra.setInfoTemplate(this._infoTemplate);
                    }
                    lyr.layerObject.add(gra);
                  } else {
                    console.log("Null geometry skipped");
                  }
                }
                this.countFeatures(lyr.layerObject, lyr.node);
                this.currentQueryList.splice(this.currentQueryList.indexOf(lyr.li.itemId), 1);
              }
            }
          }
        }
    },

    getGraphicOptions: function (item, sr, renderer) {
      var graphicOptions;
      if (typeof (item.geometry.rings) !== 'undefined') {
        graphicOptions = {
          geometry: {
            rings: item.geometry.rings,
            "spatialReference": { "wkid": sr.wkid }
          }
        };
      } else if (typeof (item.geometry.paths) !== 'undefined') {
        graphicOptions = {
          geometry: {
            paths: item.geometry.paths,
            "spatialReference": { "wkid": sr.wkid }
          }
        };
      } else {
        graphicOptions = {
          geometry: new Point(item.geometry.x, item.geometry.y, item.geometry.spatialReference),
          symbol: renderer.symbol
        };
      }
      return graphicOptions;
    },

    _initWidget: function () {
      if (this.map.itemId) {
        LayerInfos.getInstance(this.map, this.map.itemInfo)
          .then(lang.hitch(this, function (operLayerInfos) {
            this.opLayers = operLayerInfos._operLayers;
            this.opLayerInfos = operLayerInfos._layerInfos;
            this._createPanelUI(this.configLayerInfos);
          }));
      }
    },

    _createPanelUI: function (layerInfos) {
      this.numClusterLayers = 0;
      var panelTitle = this.config.mainPanelText;
      if (typeof (panelTitle) === 'undefined') {
        panelTitle = "";
      }
      this.pageTitle.innerHTML = panelTitle;
      this.panelMainIcon.innerHTML = this.config.mainPanelIcon;

      this._updateUI(null);
      this._clearChildNodes(this.pageMain);
      this.updateEnd = [];
      for (var i = 0; i < layerInfos.length; i++) {
        var lyrInfo = layerInfos[i];
        this._createLayerListItem(lyrInfo);
      }

      for (var k in this.layerList) {
        var lyr = this.layerList[k];
        if (lyr.type !== "ClusterLayer") {
          this.updateEnd.push(this.own(on(lyr.layerObject, "update-end", lang.hitch(this, this.test))));
        }
      }

      this.addMapLayers();

      this.legendNodes.push({
        node: this.pageHeader,
        styleProp: "background-color"
      });

      this.themeColorManager = new ThemeColorManager({
        updateNodes: this.legendNodes,
        layerList: this.layerList,
        theme: this.appConfig.theme,
        stylename: this.styleName
      });

    },

    _createLayerListItem: function (lyrInfo) {
      for (var ii = 0; ii < this.opLayers.length; ii++) {
        var layer = this.opLayers[ii];
        if (layer.layerType === "ArcGISMapServiceLayer") {
          var l = this._getSubLayerByURL(lyrInfo.id);
          if (typeof (l) !== 'undefined') {
            this.getLayer(l, lyrInfo, "Feature Layer");
            //var id = lyrInfo.symbolData.clusteringEnabled ? layer.id : lyrInfo.id;
            //this.countFeatures(layer.layerObject, dom.byId("recNum_" + id));
            break;
          }
        } else if (layer.layerType === "ArcGISFeatureLayer" ||
        layer.layerType === "ArcGISStreamLayer" ||
        typeof (layer.layerType) === 'undefined') {
          if (layer.layerObject && layer.id === lyrInfo.id) {
            this.getLayer(layer, lyrInfo, "Feature Layer");
            //var id = lyrInfo.symbolData.clusteringEnabled ? layer.id : lyrInfo.id;
            //this.countFeatures(layer.layerObject, dom.byId("recNum_" + id));
            break;
          } else if (layer.featureCollection) {
            for (var iii = 0; iii < layer.featureCollection.layers.length; iii++) {
              var lyr = layer.featureCollection.layers[iii];
              if (lyr.id === lyrInfo.id || layer.id === lyrInfo.id) {
                this.getLayer(lyr, lyrInfo, "Feature Collection");
                break;
              }
            }
          }
        }
      }
    },

    removeMapLayer: function (id) {
      //check if the widget was previously configured
      // with a layer that it no longer consumes...if so remove it
      var potentialNewClusterID = id + this.UNIQUE_APPEND_VAL_CL;
      if (this.map.graphicsLayerIds.indexOf(potentialNewClusterID) > -1) {
        this.map.removeLayer(this.map.getLayer(potentialNewClusterID));
      }
    },

    addMapLayers: function () {
      var reorderLayers = [];
      var ids = Object.keys(this.layerList).reverse();
      for (var i = 0; i < ids.length; i++) {
        var l = this.layerList[ids[i]];
        this.map.addLayer(l.layerObject);
        //if (l.type === "ClusterLayer") {
        reorderLayers.push(l.layerObject);
        //}
      }
      if (reorderLayers.length > 0) {
        array.forEach(reorderLayers, lang.hitch(this, function (lyr) {
          //Don't need to move if it's already at the correct index
          //make sure I think through this
          this.map.reorderLayer(lyr, ids.indexOf(lyr.id));
        }));
      }
      reorderLayers = null;
    },

    _getSubLayerByURL: function (id) {
      var n = null;
      for (var i = 0; i < this.opLayerInfos.length; i++) {
        var OpLyr = this.opLayerInfos[i];
        if (OpLyr.newSubLayers.length > 0) {
          n = this._recurseOpLayers(OpLyr.newSubLayers, id);
          if (n) {
            break;
          }
        }
      }
      return n;
    },

    _recurseOpLayers: function (pNode, id) {
      for (var i = 0; i < pNode.length; i++) {
        var Node = pNode[i];
        if (Node.newSubLayers.length > 0) {
          this._recurseOpLayers(Node.newSubLayers, id);
        } else {
          if (Node.id === id) {
            return Node;
          }
        }
      }
    },


    getLayer: function (lyr, lyrInfo, lyrType, results) {
      //TODO...this is way to redundant
      var l = null;
      var ll = null;
      var id = null;
      var _id = null;
      var infoTemplate;
      if (lyr.layerType === "ArcGISFeatureLayer" || results) {
        if (lyrInfo.symbolData.clusteringEnabled) {
          l = this._getClusterLayer(lyrInfo, lyr.layerObject, lyrType, results, infoTemplate);
          this.layerList[l.id] = {
            type: "ClusterLayer",
            layerObject: l,
            visible: true,
            id: l.id
          };
          this.numClusterLayers += 1;
        } else {
          if (lyr.parentLayerInfo) {
            if (lyr.parentLayerInfo.layerObject) {
              ll = lyr.parentLayerInfo.layerObject;
              id = lyrInfo.id;
            }
          }
          l = lyr.layerObject;
          _id = id ? id : lyrInfo.id;
          this.layerList[_id] = {
            type: ll ? lyrType : l.type,
            layerObject: ll ? ll : l,
            visible: true,
            pl: lyr,
            li: lyrInfo
          };
          this.updateRenderer(_id);
        }
      } else if (lyr.layerType === "ArcGISStreamLayer") {
        //These are the ones that are not marked as ArcGISFeatureLayer
        //I don't think this needs to be subdivided anymore either..the only real diff is type
        // and we can just test for that prior to setting
        l = lyr.layerObject;
        this.layerList[l.id] = {
          type: "StreamLayer",
          layerObject: l,
          visible: true,
          id: l.id
        };
      } else {
        //These are the ones that are not marked as ArcGISFeatureLayer
        if (lyrInfo.symbolData.clusteringEnabled) {
          l = this._getClusterLayer(lyrInfo, lyr.layerObject, lyrType, results, infoTemplate);
          this.layerList[l.id] = {
            type: "ClusterLayer",
            layerObject: l,
            visible: true,
            id: l.id
          };
          this.numClusterLayers += 1;
        } else {
          if (lyr.parentLayerInfo) {
            if (lyr.parentLayerInfo.layerObject) {
              ll = lyr.parentLayerInfo.layerObject;
              id = ll.id;
            }
          }
          l = lyr.layerObject;
          _id = id ? id : lyr.id;
          this.layerList[_id] = {
            type: ll ? lyrType : l.type,
            layerObject: ll ? ll : l,
            visible: true,
            pl: lyr,
            li: lyrInfo
          };
          this.updateRenderer(_id);
        }
      }

      if (ll) {
        this._addPanelItem(ll, lyrInfo);
      } else if (l) {
        this._addPanelItem(l, lyrInfo);
      }
    },

    updateRenderer: function (id) {
      var l = this.layerList[id];
      if (l.li.symbolData.symbolType !== 'LayerSymbol') {
        if (typeof (l.li.orgRenderer) === 'undefined') {
          //This is needed in case we configure with a custom or esri symbol
          // when a new renderer is assigned to the layer we need to still be able to get back
          // to the org for when the widget is closed or when the symbol options are re-opened
          l.li.orgRenderer = l.layerObject.renderer;
        }
        var renderer = new SimpleRenderer(jsonUtils.fromJson(l.li.symbolData.symbol));
        l.layerObject.setRenderer(renderer);
        l.layerObject.refresh();
      }
    },

    _addPanelItem: function (layer, lyrInfo) {
      layer.setVisibility(true);

      //var id = lyrInfo.symbolData.clusteringEnabled ? layer.id : lyrInfo.id;
      var id = layer.id;

      var rec = domConstruct.create("div", {
        'class': "rec"
      }, this.pageMain);
      var classNames = "recIcon";
      classNames += " active";
      var recIcon = domConstruct.create("div", {
        'class': classNames,
        id: "recIcon_" + id,
        innerHTML: lyrInfo.imageData
      }, rec);
      domConstruct.create("div", {
        'class': "recLabel",
        innerHTML: "<p>" + lyrInfo.label + "</p>"
      }, rec);
      var recNum = domConstruct.create("div", {
        'class': "recNum",
        id: "recNum_" + id,
        innerHTML: ""
      }, rec);

      var lyrType = this.layerList[id].type;
      //if (lyrType === "StreamLayer") {
      //  //this._addLegend(layer, lyrInfo);
      //  this.layerList[id].node = recNum;
      //  this.layerList[id].countFeatures(layer, recNum);
      //} else if (lyrType === "ClusterLayer") {
      //  this._addClusterLegend(layer, lyrInfo.imageData, lyrInfo);
      //  layer.node = recNum;
      //  layer.clusterFeatures();
      //} else {
      //  //this._addLegend(layer, lyrInfo);
      //  this.layerList[id].node = recNum;
      //}

      if (lyrType === "ClusterLayer") {
        this._addClusterLegend(layer, lyrInfo.imageData, lyrInfo);
        layer.node = recNum;
        layer.clusterFeatures();
      } else {
        this._addLegend(layer, lyrInfo);
        this.layerList[id].node = recNum;
      }

      on(recIcon, "click", lang.hitch(this, this._toggleLayer, this.layerList[id]));
      //on(rec, "click", lang.hitch(this, this._toggleLegend, this.layerList[id]));

      if (this.layerList[id].pl){
        if (!this.layerList[id].pl.featureSet) {
          //TODO..make sure this is a valid FC check for multiSub layers in a FC
          this.countFeatures(this.layerList[id].layerObject, recNum);
        }
      }
    },

    _addClusterLegend: function (layer, img) {
      var legendDiv = domConstruct.create("div", {
        'class': "esriLegendLayer legendOff",
        id: "legend_" + layer.id
      }, this.pageMain);

      var symbolDiv2 = domConstruct.create("div", {
        'class': "clusterSymbol2",
        id: "legend_symbol2_" + layer.id
      }, legendDiv);

      var symbolDiv = domConstruct.create("div", {
        'class': "clusterSymbol recImg2",
        id: "legend_symbol_" + layer.id,
        innerHTML: img
      }, symbolDiv2);

      this.legendNodes.push({ node: symbolDiv, styleProp: "background-color" });
    },

    _addLegend: function (layer, lyrInfo) {
      //TODO investigate why this doesn't get cleared on clearChldNodes
      var component = registry.byId("legend_" + layer.id);
      if (component) {
        component.destroyRecursive();
        domConstruct.destroy(component);
      }

      var legendDiv = domConstruct.create("div", {
        class: "esriLegendLayer legendOff",
        id: "legend_" + layer.id
      }, this.pageMain);

      var legend = new Legend({
        "autoUpdate": false,
        "respectCurrentMapScale": true,
        "layerInfos": [{
          "defaultSymbol": false,
          "layer": layer
        }],
        "map": this.map
      }, legendDiv);

      //legend.startup();

      //this._loadLayerSymbol(layer, legendDiv);
    },

    _loadLayerSymbol: function (layer, legendDiv) {
      if (typeof (layer.renderer) !== 'undefined') {
        var renderer = layer.renderer;
        if (typeof (renderer.symbol) !== 'undefined') {
          //this.symbol = renderer.symbol;
          //this.layerSym.innerHTML = this._createImageDataDiv(this.symbol, false, this.layerSym).innerHTML;
          this._createImageDataDiv(renderer.symbol, true, legendDiv);
        } else if (typeof (renderer.infos) !== 'undefined') {
          this.layerSym.innerHTML = this._createCombinedImageDataDiv(renderer.infos, false).innerHTML;
        } else if (typeof (renderer.uniqueValueInfos) !== 'undefined') {
          this.layerSym.innerHTML = this._createCombinedImageDataDiv(renderer.uniqueValueInfos, true).innerHTML;
        } else if (typeof (renderer.classBreakInfos) !== 'undefined') {
          this.layerSym.innerHTML = this._createCombinedImageDataDiv(renderer.classBreakInfos, true).innerHTML;
        }
      }
    },

    _createImageDataDiv: function (sym, convert, node) {
      var a = domConstruct.create("div", { 'class': "imageDataGFX" }, node);
      var symbol = convert ? jsonUtils.fromJson(sym) : sym;
      if (!symbol) {
        symbol = sym;
      }
      this.symbol = symbol;
      //this.renderSymbols.push(this.symbol);
      var mySurface = gfx.createSurface(a, 26, 26);
      var descriptors = jsonUtils.getShapeDescriptors(this.setSym(symbol));
      var shape = mySurface.createShape(descriptors.defaultShape)
                    .setFill(descriptors.fill)
                    .setStroke(descriptors.stroke);
      shape.applyTransform({ dx: 13, dy: 13 });
      return a;
    },

    _createCombinedImageDataDiv: function (infos, convert) {
      var a = domConstruct.create("div", { 'class': "imageDataGFXMulti" }, legendDiv);

      for (var i = 0; i < infos.length; i++) {
        var sym = infos[i].symbol;
        var symbol = jsonUtils.fromJson(sym);
        if (!symbol) {
          symbol = sym;
        }
        //if (typeof (this.symbol) === 'undefined') {
        //  this.symbol = symbol;
        //}
        //this.renderSymbols.push(symbol);

        var b = domConstruct.create("div", { 'class': "imageDataGFX imageDataGFX2" }, a);
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

    _getClusterLayer: function (lyrInfo, lyr, lyrType, results, infoTemplate) {
      var clusterLayer = null;
      var n;
      var potentialNewID = lyrInfo.id + this.UNIQUE_APPEND_VAL_CL;
      if (this.map.graphicsLayerIds.indexOf(potentialNewID) > -1) {
        clusterLayer = this.map.getLayer(potentialNewID);

        var reloadData = false;
        var refreshData = false;

        //update the symbol if it has changed
        if (JSON.stringify(clusterLayer.symbolData) !== JSON.stringify(lyrInfo.symbolData)) {
          clusterLayer.symbolData = lyrInfo.symbolData;
          refreshData = true;
        }

        //update the icon if it has changed
        n = domConstruct.toDom(lyrInfo.imageData);
        if (JSON.stringify(clusterLayer.icon) !== JSON.stringify(n.src)) {
          clusterLayer.icon = n.src;
          refreshData = true;
        }
        domConstruct.destroy(n.id);

        if (clusterLayer.refresh !== lyrInfo.refresh) {
          clusterLayer.refresh = lyrInfo.refresh;
          reloadData = true;
        }

        if (refreshData) {
          clusterLayer._setupSymbols();
        }

        if (reloadData) {
          clusterLayer.refreshFeatures(clusterLayer.url);
        } else if (refreshData) {
          clusterLayer.clusterFeatures();
        }
      } else {
        var features;
        if (lyrType === "Feature Collection") {
          features = [];
          for (var i = 0; i < lyr.graphics.length; i++) {
            var g = lyr.graphics[i];
            if (g.geometry) {
              if (g.geometry.x) {
                features.push({
                  geometry: new Point(g.geometry.x, g.geometry.y, g.geometry.spatialReference),
                  attributes: g.attributes
                });
              } else {
                features.push(g);
              }
            }
          }
        }
        //change this to pretty much just pass the layerInfo...layerInfo should contain all the other stuff that we
        // have to test for all over the place...all this should be captured up front as a part of the config experience
        n = domConstruct.toDom(lyrInfo.imageData);
        var options = {
          name: lyrInfo.label + this.UNIQUE_APPEND_VAL_CL,
          id: potentialNewID,
          map: this.map,
          node: dom.byId("recNum_" + potentialNewID),
          features: features,
          infoTemplate: typeof (lyr.infoTemplate) !== 'undefined' ? lyr.infoTemplate : infoTemplate,
          refreshInterval: this.config.refreshInterval,
          refreshEnabled: this.config.refreshEnabled,
          mapServiceResults: results,
          parentLayer: lyr,
          imD2: n.src,
          lyrInfo: lyrInfo
        };

        domConstruct.destroy(n.id);
        clusterLayer = new ClusterLayer(options);
      }
      return clusterLayer;
    },

    _updateUI: function (styleName) {
      this.styleName = styleName;
      if (Object.keys(this.layerList).length > 0) {
        this.themeColorManager = new ThemeColorManager({
          updateNodes: this.legendNodes,
          layerList: this.layerList,
          theme: this.appConfig.theme,
          stylename: styleName
        });
      }
    },

    _toggleLayer: function (obj) {
      this.map.infoWindow.hide();

      var id = obj.id ? obj.id : obj.layerObject.id;
      if (obj.pl) {
        id = obj.pl.id;
      }

      var lyr = this.layerList[id];

      if (!lyr) {
        //if (obj.li) {
        //  id = obj.li.id;
        //}
        lyr = this.layerList[id];
      }

      if (lyr) {
        var hasSubLayerId = false;
        if (lyr.li) {
          if (lyr.li.hasOwnProperty("subLayerId")) {
            hasSubLayerId = typeof (lyr.li.subLayerId) !== 'undefined';
          }
        }
        var visLayers;
        var l;
        if (domClass.contains("recIcon_" + id, "active")) {
          domClass.remove("recIcon_" + id, "active");
          if (hasSubLayerId) {
            visLayers = lyr.layerObject.visibleLayers;
            var lyrIndex = visLayers.indexOf(lyr.li.subLayerId);
            if (lyrIndex > -1) {
              visLayers.splice(lyrIndex, 1);
            }
            lyr.layerObject.setVisibleLayers(visLayers);
            lyr.layerObject.setVisibility(true);
          } else if (lyr) {
            lyr.layerObject.setVisibility(false);
            this.layerList[id].visible = false;
            if (typeof (lyr.pl) !== 'undefined') {
              lyr.pl.visibility = false;
              if (this.map.graphicsLayerIds.indexOf(id) > -1) {
                l = this.map.getLayer(id);
                l.setVisibility(false);
              }
            }
          }
        } else {
          domClass.add("recIcon_" + id, "active");
          if (hasSubLayerId) {
            visLayers = lyr.layerObject.visibleLayers;
            visLayers.push(lyr.li.subLayerId);
            lyr.layerObject.setVisibleLayers(visLayers);
            lyr.layerObject.setVisibility(true);
          } else if (lyr) {
            lyr.layerObject.setVisibility(true);
            if (lyr.type === 'ClusterLayer') {
              lyr.layerObject.flashFeatures();
            }
            this.layerList[id].visible = true;
            if (typeof (lyr.pl) !== 'undefined') {
              lyr.pl.visibility = true;
              if (this.map.graphicsLayerIds.indexOf(id) > -1) {
                l = this.map.getLayer(id);
                l.setVisibility(true);
              }
            }
          }
        }
      }
    },

    _toggleLegend: function (obj, evt) {
      if (evt.currentTarget.className !== 'thumb2' && evt.currentTarget.className !== 'recIcon') {
        var id = obj.layerObject.id;
        if (domClass.contains("legend_" + id, "legendOff")) {
          domClass.remove("legend_" + id, "legendOff");
          domClass.add("legend_" + id, "legendOn");
        } else {
          if (domClass.contains("legend_" + id, "legendOn")) {
            domClass.remove("legend_" + id, "legendOn");
            domClass.add("legend_" + id, "legendOff");
          }
        }
      }
    },

    onAppConfigChanged: function (appConfig, reason, changedData) {
      switch (reason) {
        case 'themeChange':
        case 'layoutChange':
          this.destroy();
          break;
        case 'styleChange':
          this._updateUI(changedData);
          break;
        case 'widgetChange':
          this.widgetChange = true;
          break;
      }
    },

    setPosition: function (position, containerNode) {
      //TODO still need to investigate how to fully fit into the Box, Dart, and Launchpad themes
      //This would still allow the widget to function somewhat but not fully be a part of the theme
      // may be better to just not support these themes until we work out the details
      var pos;
      var style;
      if (this.appConfig.theme.name === "BoxTheme") {
        this.inherited(arguments);
        pos = {
          right: "0px",
          bottom: "0px",
          top: "0px",
          height: "auto",
          'z-index': "auto"
        };
        this.position = pos;
        style = utils.getPositionStyle(this.position);
        style.position = 'absolute';
        containerNode = this.map.id;
        html.place(this.domNode, containerNode);
        html.setStyle(this.domNode, style);

        domStyle.set(this.pageContent, "bottom", "60px");
      } else if (this.appConfig.theme.name === "DartTheme") {
        this.inherited(arguments);
        pos = {
          right: "0px",
          bottom: "80px",
          top: "0px",
          height: "auto",
          'z-index': "auto"
        };
        this.position = pos;
        style = utils.getPositionStyle(this.position);
        style.position = 'absolute';
        containerNode = this.map.id;
        html.place(this.domNode, containerNode);
        html.setStyle(this.domNode, style);
      } else if (this.appConfig.theme.name === "LaunchpadTheme") {
        this.inherited(arguments);
        //var pos = {
        //  left: "0px",
        //  bottom: "0px",
        //  top: "0px",
        //  height: "auto",
        //  'z-index': "1"
        //};
        //this.position = pos;
        //var style = utils.getPositionStyle(this.position);
        //style.position = 'absolute';
        //containerNode = this.map.id;
        //html.place(this.domNode, containerNode);
        //html.setStyle(this.domNode, style);

        //domStyle.set(this.pageContent, "bottom", "120px");
        //domStyle.set(this.pageContent, "top", "80px");
      } else {
        pos = {
          right: "0px",
          bottom: "0px",

          height: "none",
          'z-index': "auto"
        };
        this.position = pos;
        style = utils.getPositionStyle(this.position);
        style.position = 'absolute';
        containerNode = this.map.id;
        html.place(this.domNode, containerNode);
        html.setStyle(this.domNode, style);
      }
    },

    _close: function () {
      this.widgetManager.closeWidget(this.id);
    },

    onClose: function () {
      this.inherited(arguments);

      if (this.p) {
        clearTimeout(this.p);
      }

      if (this.queryList) {
        this.queryList.cancel();
        this.queryLookupList = [];
      }

      this.layerVisibilityManager.resetLayerVisibility();
      this.layerVisibilityManager = null;

      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = undefined;
      }

      this.mapExtentChangedHandler = null;
    },

    _clearChildNodes: function (parentNode) {
      while (parentNode.hasChildNodes()) {
        parentNode.removeChild(parentNode.lastChild);
      }
    },

    test: function (results) {
      var lyr = this.layerList[results.target.id];
      if (lyr) {
        this.countFeatures(lyr.layerObject, dom.byId("recNum_" + lyr.li.id));
      }
    },

    _mapExtentChange: function () {
      var queries = [];
      var updateNodes = [];
      for (var key in this.layerList) {
        var lyr = this.layerList[key];

        //var isMapService = false;
        if(lyr.li){
          if(lyr.li.url){
            var url = lyr.li.url;
            if(url.indexOf("MapServer") > -1){
              var q = new Query();
              q.geometry = this.map.extent;
              q.returnGeometry = false;

              //var qt = new QueryTask(lyr.layerObject.url);
              var qt = new QueryTask(url);
              queries.push(qt.executeForIds(q));
              updateNodes.push(dom.byId("recNum_" + lyr.li.id));
            }
          }
        }

        if (lyr.type !== 'ClusterLayer') {
          if (typeof (lyr.layerObject) === 'undefined') {
            console.log("layer object not known");
          } else if(lyr.pl.featureSet){
            //TODO..make sure this is a valid FC check for multiSub layers in a FC
            this.countFeatures(lyr.layerObject, dom.byId("recNum_" + lyr.layerObject.id));
          }
        }
      }
      if (queries.length > 0) {
        var promises = all(queries);
        promises.then(function (results) {
          for (var i = 0; i < results.length; i++) {
            updateNodes[i].innerHTML = results[i].length;
          }
        });
      }
    },

    countFeatures: function (lyr, node) {
      var q = new Query();
      q.geometry = this.map.extent;
      if (lyr.queryCount) {
        lyr.queryCount(q, lang.hitch(this, function (r) {
          if (node) {
            node.innerHTML = r;
          }
        }));
      }
    }
  });
});
