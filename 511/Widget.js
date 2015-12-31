///////////////////////////////////////////////////////////////////////////
// Copyright ? 2015 Esri. All Rights Reserved.
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

define(['jimu/BaseWidget', 'jimu/LayerInfos/LayerInfoFactory', 'jimu/LayerInfos/LayerInfos', 'jimu/utils',
    'dojo/dom', 'dojo/dom-class', 'dojo/dom-construct', 'dojo/on', 'dojo/dom-style', 'dojo/_base/declare', 'dojo/_base/xhr', 'dojo/_base/Color', 'dojo/_base/lang', 'dojo/_base/html', 'dojo/promise/all', 'dojo/topic', 'dojo/_base/array', 'dojo/DeferredList',
    'dijit/_WidgetsInTemplateMixin', "dijit/registry",
    'esri/dijit/PopupTemplate', 'esri/graphic', 'esri/request', 'esri/geometry/Point', 'esri/layers/FeatureLayer', 'esri/tasks/query', 'esri/tasks/QueryTask', 'esri/dijit/Legend',
    './js/ClusterLayer', './js/DataLoader', './js/ThemeColorManager', './js/LayerVisibilityManager'
],
function (BaseWidget, LayerInfoFactory, LayerInfos, utils,
    dom, domClass, domConstruct, on, domStyle, declare, xhr, Color, lang, html, all, topic, array, DeferredList,
    _WidgetsInTemplateMixin, registry,
    PopupTemplate, Graphic, esriRequest, Point, FeatureLayer, Query, QueryTask, Legend,
    ClusterLayer, DataLoader, ThemeColorManager, LayerVisibilityManager
  ) {
  return declare([BaseWidget, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-511',

    name: "511",
    opLayers: null,
    opLayerInfos: null,
    layerList: {},
    UNIQUE_APPEND_VAL_CL: "_CL",
    UNIQUE_APPEND_VAL_FC: "_FCGL",
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
    popupSelectionChanged: null,
    currentClusterLayer: null,

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
    },

    onOpen: function () {
      this.widgetChange = false;

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

      //this.popupSelectionChanged = this.map.infoWindow.on("selection-change", lang.hitch(this, function () {
      //  //var graphic = this.map.infoWindow.getSelectedFeature();
      //  //if (this.map.infoWindow.selectedIndex > -1) {
      //  //  this.map.infoWindow.select(this.map.infoWindow.selectedIndex);
      //  //}
      //  //if (graphic) {
      //  //  if (graphic.hasOwnProperty('_graphicsLayer')) {
      //  //    var l = graphic._graphicsLayer;
      //  //    if (l.hasOwnProperty('_showSingles')) {
      //  //      if (l._showSingles) {
      //  //        this.currentClusterLayer = l;
      //  //      }
      //  //    }
      //  //  } else {
      //  //    this.currentClusterLayer.flashSingle(graphic);
      //  //  }
      //  //}
      //}));
    },

    //_popupSelectionChangedHandler: function(){
    //  //need to find what layer this originated from and then call flashSingles
    //  var graphic = this.map.infoWindow.getSelectedFeature();
    //  if (graphic) {
    //    if (graphic.hasOwnProperty('_graphicsLayer')) {
    //      var l = graphic._graphicsLayer;
    //      if (l.hasOwnProperty('_showSingles')) {
    //        if (l._showSingles) {
    //          l.flashSingles();
    //        }
    //      }
    //    }
    //  }
    //},

    enableRefresh: function () {
      //set refreshItereval on all widget source layers that support it
      var lyr = null;
      for (var key in this.layerList) {
        var lyr = this.layerList[key];
        if (lyr.type !== "ClusterLayer" || lyr.type !== "FeatureCollectionLayer") {
          lyr = lyr.layerObject;
        } else {
          var id = lyr.layerObject.id;
          var lenID = id.length;
          var sourceLayerID = id.replace(this.UNIQUE_APPEND_VAL_CL, "");
          if (lenID === sourceLayerID.length) {
            sourceLayerID = id.replace(this.UNIQUE_APPEND_VAL_FC, "");
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
          if (typeof (lyr.refreshInterval) !== 'undefined') {
            lyr.refreshInterval = this.config.refreshInterval;
          }
        }
      }

      //refresh the cluster layers at the same interval
      //TODO only need to reset this if the value has changed 
      //if (!this.refreshInterval) {
      //this.refreshInterval = setInterval(lang.hitch(this, this.refreshLayers), (this.config.refreshInterval * 60000));
      //}

      this.refreshInterval = setInterval(lang.hitch(this, this.refreshLayers), (this.config.refreshInterval * 30000));
    },

    refreshLayers: function () {
      for (var key in this.layerList) {
        var lyr = this.layerList[key];
        if (lyr.type === "FeatureCollectionLayer") {
          lyr.dataLoader.refreshFeatures();
        } else if (lyr.type === "ClusterLayer") {
          lyr.layerObject.refreshFeatures();
        }
      }
    },

    _initWidget: function () {
      if (this.map.itemId) {
        LayerInfos.getInstance(this.map, this.map.itemInfo)
          .then(lang.hitch(this, function (operLayerInfos) {
            this.opLayers = operLayerInfos._operLayers;

            //workaround change in jimu
            if (parseFloat(this.appConfig.wabVersion) < 1.4) {
              this.opLayerInfos = operLayerInfos._layerInfos;
            } else {
              this.opLayerInfos = operLayerInfos._layerInfos;
            }

            this._createPanelUI(this.configLayerInfos);
          }));
      }
    },

    _createPanelUI: function (layerInfos) {
      var panelTitle = this.config.mainPanelText;
      if (typeof (panelTitle) === 'undefined') {
        panelTitle = "";
      }
      this.pageTitle.innerHTML = panelTitle;
      this.panelMainIcon.innerHTML = this.config.mainPanelIcon;

      this._updateUI(null);
      this._clearChildNodes(this.pageMain);

      for (var i = 0; i < layerInfos.length; i++) {
        var lyrInfo = layerInfos[i];

        //TODO need a way to remove the layer if it was previously referenced but is no longer referenced
        //if (lyrInfo.use) {
        this._createLayerListItem(lyrInfo);
        //} else{
        //  this.removeMapLayer(lyrInfo.id);
        //}
      }
      this.addMapLayers();
    },

    _createLayerListItem: function (lyrInfo) {
      for (var ii = 0; ii < this.opLayers.length; ii++) {
        var layer = this.opLayers[ii];
        var layerGeomType = "";
        if (layer.layerType === "ArcGISMapServiceLayer") {
          var l = this._getSubLayerByURL(lyrInfo.id);
          if (typeof (l) !== 'undefined') {
            this._updateLayerList(l, lyrInfo, "Feature Layer");
            break;
          }
        } else if (layer.layerType === "ArcGISFeatureLayer" || layer.layerType === "ArcGISStreamLayer" || typeof (layer.layerType) === 'undefined') {
          if (layer.layerObject && layer.id === lyrInfo.id) {
            this._updateLayerList(layer, lyrInfo, "Feature Layer");
            break;
          } else if (layer.featureCollection) {
            for (var iii = 0; iii < layer.featureCollection.layers.length; iii++) {
              var lyr = layer.featureCollection.layers[iii];
              if (lyr.id === lyrInfo.id || layer.id === lyrInfo.id) {
                this._updateLayerList(lyr, lyrInfo, "Feature Collection");
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
      var potentialNewFCID = id + this.UNIQUE_APPEND_VAL_FC;

      if (this.map.graphicsLayerIds.indexOf(potentialNewClusterID) > -1) {
        this.map.removeLayer(this.map.getLayer(potentialNewClusterID));
      } else if (this.map.graphicsLayerIds.indexOf(potentialNewFCID) > -1) {
        this.map.removeLayer(this.map.getLayer(potentialNewFCID));
      }
    },

    addMapLayers: function () {
      var reorderLayers = [];
      var ids = Object.keys(this.layerList).reverse();
      for (var i = 0; i < ids.length; i++) {
        var l = this.layerList[ids[i]];
        this.map.addLayer(l.layerObject);
        if (l.type === "FeatureCollectionLayer" || l.type === "ClusterLayer") {
          reorderLayers.push(l.layerObject);
        }
      }

      if (reorderLayers.length > 0) {
        array.forEach(reorderLayers, lang.hitch(this, function (lyr) {
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
          var n = this._recurseOpLayers(OpLyr.newSubLayers, id);
          if (n) {
            break;
          }
        }
      }
      return n;
    },

    _recurseOpLayers: function (pNode, id) {
      var nodeGrp = pNode;
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

    _updateLayerList: function (lyr, lyrInfo, lyrType) {
      var geomType = lyrInfo.geometryType;
      this.getLayer(lyr, lyrInfo, lyrType, geomType);
    },

    getLayer: function (lyr, lyrInfo, lyrType, geomType, results) {

      //TODO...this is way to redundant

      var l = null;
      if (geomType === "esriGeometryPoint") {
        if (lyr.layerType === "ArcGISFeatureLayer" || results) {

          //TODO...this part feels sloppy
          //TODO...look to see what all info could be captured as a part of settings
          //less work we have to do here the better
          var infoTemplate = undefined;
          if (lyr.originOperLayer) {
            if (lyr.originOperLayer.parentLayerInfo.controlPopupInfo.infoTemplates) {
              infoTemplates = lyr.originOperLayer.parentLayerInfo.controlPopupInfo.infoTemplates;
              subLayerId = lyrInfo.url.split("/").pop();
              if (subLayerId in infoTemplates) {
                infoTemplate = infoTemplates[subLayerId].infoTemplate;
              }
            }
          }
          if (lyrInfo.symbolData.clusteringEnabled) {
            l = this._getClusterLayer(lyrInfo, lyr.layerObject, lyrType, results, infoTemplate);
            this.layerList[l.id] = {
              type: "ClusterLayer",
              layerObject: l,
              visible: true
            };
          } else {
            var dl = this._getFeatureCollection(lyrInfo, lyr, lyrType, results);
            l = dl.mapLayer;
            this.layerList[l.id] = {
              type: "FeatureCollectionLayer",
              layerObject: l,
              visible: true,
              pl: lyr,
              dataLoader: dl
            };
          }
        } else if (lyr.layerType === "ArcGISStreamLayer") {
          var dl = this._getStreamLayer(lyrInfo, lyr, lyrType);
          l = dl.mapLayer;
          this.layerList[l.id] = {
            type: "StreamLayer",
            layerObject: l,
            visible: true,
            dataLoader: dl
          };
        } else {
          if (lyrInfo.symbolData.clusteringEnabled) {
            l = this._getClusterLayer(lyrInfo, lyr.layerObject, lyrType, results, infoTemplate);
            this.layerList[l.id] = {
              type: "ClusterLayer",
              layerObject: l,
              visible: true
            };
          } else {
            var dl = this._getFeatureCollection(lyrInfo, lyr, lyrType, results);
            l = dl.mapLayer;
            this.layerList[l.id] = {
              type: "FeatureCollectionLayer",
              layerObject: l,
              visible: true,
              pl: lyr,
              dataLoader: dl
            };
          }

        }
      } else {
        var dl = this._getFeatureCollection(lyrInfo, lyr, lyrType, results);
        l = dl.mapLayer;
        this.layerList[l.id] = {
          type: "FeatureCollectionLayer",
          layerObject: l,
          visible: true,
          pl: lyr,
          dataLoader: dl
        };
      }

      if (l) {
        this._addPanelItem(l, lyrInfo);
      }
    },

    _addPanelItem: function (layer, lyrInfo) {
      layer.setVisibility(true);

      var rec = domConstruct.create("div", {
        class: "rec"
      }, this.pageMain);
      var classNames = "recIcon";
      classNames += " active";
      var recIcon = domConstruct.create("div", {
        class: classNames,
        id: "recIcon_" + layer.id,
        innerHTML: lyrInfo.imageData
      }, rec);
      var recLabel = domConstruct.create("div", {
        class: "recLabel",
        innerHTML: "<p>" + lyrInfo.label + "</p>"
      }, rec);
      var recNum = domConstruct.create("div", {
        class: "recNum",
        id: "recNum_" + layer.id,
        innerHTML: ""
      }, rec);

      var lyrType = this.layerList[layer.id].type;
      if (lyrType === "FeatureCollectionLayer" || lyrType === "StreamLayer") {
        this._addLegend(layer);
        this.layerList[layer.id].dataLoader._node = recNum;
        this.layerList[layer.id].dataLoader.countFeatures();
      } else if (lyrType === "ClusterLayer") {
        this._addClusterLegend(layer, lyrInfo.imageData);
        layer.node = recNum;
        layer.clusterFeatures();
      }

      //this._addLegend(layer)

      on(recIcon, "click", lang.hitch(this, this._toggleLayer, layer));
      on(rec, "click", lang.hitch(this, this._toggleLegend, layer));

      //on(rec, "right-click", lang.hitch(this, this._showMenu, layer));
    },

    _addLegend: function (layer) {
      //TODO replace this with convert to SVG code
      // Think I'll write a dijit that outputs a collection tables...with the desc or whatever it's called and the SVG graphic
      // this way I'll have complete control on the layout...but also more code to manage

      var component = registry.byId("legend_" + layer.id);
      if (component) {
        component.destroyRecursive();
        domConstruct.destroy(component);
      }

      var legendDiv = domConstruct.create("div", {
        class: "esriLegendLayer legendOff",
        id: "legend_" + layer.id
      }, this.pageMain);

      var symbolDiv2 = domConstruct.create("div", {
        class: "clusterSymbol2",
        id: "legend_symbol2_" + layer.id,
      }, legendDiv);

      var legend = new Legend({
        "autoUpdate": false,
        "respectCurrentMapScale": true,
        "layerInfos": [{
          "defaultSymbol": false,
          "layer": layer
        }],
        "map": this.map
      }, symbolDiv2);

      //legend.startup();
    },

    _addClusterLegend: function (layer, img) {
      var legendDiv = domConstruct.create("div", {
        class: "esriLegendLayer legendOff",
        id: "legend_" + layer.id
      }, this.pageMain);

      var symbolDiv2 = domConstruct.create("div", {
        class: "clusterSymbol2",
        id: "legend_symbol2_" + layer.id,
      }, legendDiv);

      var symbolDiv = domConstruct.create("div", {
        class: "clusterSymbol recImg2",
        id: "legend_symbol_" + layer.id,
        innerHTML: img
      }, symbolDiv2);


      this.legendNodes.push({ node: symbolDiv, styleProp: "background-color" });
    },

    _getClusterLayer: function (lyrInfo, lyr, lyrType, results, infoTemplate) {
      var clusterLayer = null;
      var potentialNewID = lyrInfo.id + this.UNIQUE_APPEND_VAL_CL;
      if (this.map.graphicsLayerIds.indexOf(potentialNewID) > -1) {
        clusterLayer = this.map.getLayer(potentialNewID);

        var reloadData = false;

        //update the filter if it has changed
        if (JSON.stringify(clusterLayer.filter) !== JSON.stringify(lyrInfo.filter)) {
          clusterLayer.filter = lyrInfo.filter;
          reloadData = true;
        }

        //update the symbol if it has changed
        if (JSON.stringify(clusterLayer.symbolData) !== JSON.stringify(lyrInfo.symbolData)) {
          clusterLayer.symbolData = lyrInfo.symbolData;
          reloadData = true;
        }

        //update the icon if it has changed
        var n = domConstruct.toDom(lyrInfo.imageData);
        if (JSON.stringify(clusterLayer.icon) !== JSON.stringify(n.src)) {
          clusterLayer.icon = n.src;
        }
        domConstruct.destroy(n.id);

        if (clusterLayer.refresh !== lyrInfo.refresh) {
          clusterLayer.refresh = lyrInfo.refresh;
          reloadData = true;
        }

        if (reloadData) {
          clusterLayer.refreshFeatures(clusterLayer.url);
        }
      } else {
        var features;
        if (lyrType === "Feature Collection") {
          features = [];
          for (var i = 0; i < lyr.graphics.length; i++) {
            var g = lyr.graphics[i];
            features.push({
              geometry: new Point(g.geometry.x, g.geometry.y, g.geometry.spatialReference),
              attributes: g.attributes
            });
            //features.push(g);
          }
        }
        var n = domConstruct.toDom(lyrInfo.imageData);
        var options = {
          name: lyrInfo.label + this.UNIQUE_APPEND_VAL_CL,
          id: potentialNewID,
          icon: n.src,
          map: this.map,
          node: dom.byId("recNum_" + potentialNewID),
          features: features,
          infoTemplate: typeof (lyr.infoTemplate) !== 'undefined' ? lyr.infoTemplate : infoTemplate,
          url: lyrInfo.url,
          refreshInterval: this.config.refreshInterval,
          refreshEnabled: this.config.refreshEnabled,
          mapServiceResults: results,
          filter: lyrInfo.filter,
          refresh: lyrInfo.refresh,
          symbolData: lyrInfo.symbolData,
          parentLayer: lyr,
          itemId: lyrInfo.itemId
        };
        domConstruct.destroy(n.id);
        clusterLayer = new ClusterLayer(options);
      }
      return clusterLayer;
    },

    _getFeatureCollection: function (lyrInfo, lyr, lyrType, results) {
      var dataLoader = null;
      var potentialNewID = lyrInfo.id + this.UNIQUE_APPEND_VAL_FC;
      if (potentialNewID in Object.keys(this.layerList)) {
        dataLoader = this.layerList[potentialNewID].dataLoader;

        var lyrInfoHasFilter = typeof (lyrInfo.filter) !== 'undefined' ? true : false;
        if (typeof (dataLoader.filter) !== 'undefined' && lyrInfoHasFilter) {
          if (dataLoader.filter.expr !== lyrInfo.filter.expr) {
            dataLoader.filter = lyrInfo.filter;
            dataLoader.loadData(dataLoader.url);
          }
        }

        dataLoader.refresh = lyrInfo.refresh;
      } else {
        //TODO...still deciding if the optional features option will stay
        // could just go to URL for all inital loading
        var hasFeatures = (lyrType === "Feature Collection") ? true : false;
        dataLoader = new DataLoader({
          parentLayer: lyr,
          map: this.map,
          id: potentialNewID,
          name: lyrInfo.label,
          node: dom.byId("recNum_" + potentialNewID),
          layerInfo: lyrInfo,
          features: hasFeatures ? lyr.layerObject.graphics : undefined,
          refreshEnabled: this.config.refreshEnabled,
          layerType: lyrType,
          mapServiceResults: results,
          parent: this.w,
          filter: lyrInfo.filter,
          refresh: lyrInfo.refresh,
          symbolData: lyrInfo.symbolData,
          geometryType: lyrInfo.geometryType,
          itemId: lyrInfo.itemId,
          renderer: lyrInfo.renderer,
          drawingInfo: lyrInfo.drawingInfo
        });
      }
      return dataLoader;
    },

    _getStreamLayer: function (lyrInfo, lyr, lyrType) {
      //TODO how would QueryFilter work with these??

      //pretty much the same as FC but we don't add a new layer instance
      // symbology would be different

      //TODO make sure that lyrType is Stream something...need it to tell the diff in the loader
      //don't load anything for these just set up different event handlers
      var dataLoader = null;
      var potentialNewID = lyrInfo.id;
      if (potentialNewID in Object.keys(this.layerList)) {
        //TODO need to figure out what QueryFilters mean for these
        dataLoader = this.layerList[potentialNewID].dataLoader;
      } else {
        //TODO...still deciding if the optional features option will stay
        // could just go to URL for all inital loading
        dataLoader = new DataLoader({
          parentLayer: lyr,
          map: this.map,
          id: potentialNewID,
          name: lyrInfo.label,
          node: dom.byId("recNum_" + potentialNewID),
          layerInfo: lyrInfo,
          layerType: lyrType,
          filter: lyrInfo.filter,
          symbolData: lyrInfo.symbolData
        });
      }
      return dataLoader;
    },

    _updateUI: function (styleName) {

      var nodes = this.legendNodes;
      nodes.push({
        node: this.pageHeader,
        styleProp: "background-color"
      });

      var themeColorManager = new ThemeColorManager({
        updateNodes: nodes,
        layerList: this.layerList,
        theme: this.appConfig.theme,
        stylename: styleName
      });
    },

    _toggleLayer: function (obj) {
      this.map.infoWindow.hide();
      var id = obj.id;
      var lyr = this.layerList[obj.id];
      if (domClass.contains("recIcon_" + id, "active")) {
        domClass.remove("recIcon_" + id, "active");
        if (lyr) {
          lyr.layerObject.setVisibility(false);
          this.layerList[obj.id].visible = false;
          if (typeof (lyr.pl) !== 'undefined') {
            lyr.pl.visibility = false;
            if (this.map.graphicsLayerIds.indexOf(obj.id) > -1) {
              var l = this.map.getLayer(obj.id);
              l.setVisibility(false);
            }
          }
        }
      } else {
        domClass.add("recIcon_" + id, "active");
        if (lyr) {
          lyr.layerObject.setVisibility(true);
          if (lyr.type === 'ClusterLayer') {
            //TODO still need to wrok on that
            lyr.layerObject.flashFeatures();
          } else if (lyr.type === 'FeatureCollectionLayer') {
            lyr.dataLoader.flashFeatures();
          }
          this.layerList[obj.id].visible = true;
          if (typeof (lyr.pl) !== 'undefined') {
            lyr.pl.visibility = true;
            if (this.map.graphicsLayerIds.indexOf(obj.id) > -1) {
              var l = this.map.getLayer(obj.id);
              l.setVisibility(true);
            }
          }
        }
      }
    },

    _toggleLegend: function (obj, evt) {
      if (evt.target.className.indexOf('thumb2') === -1 && evt.target.className.indexOf('recIcon') === -1) {
        if (domClass.contains("legend_" + obj.id, "legendOff")) {
          domClass.remove("legend_" + obj.id, "legendOff");
          domClass.add("legend_" + obj.id, "legendOn");
        } else {
          if (domClass.contains("legend_" + obj.id, "legendOn")) {
            domClass.remove("legend_" + obj.id, "legendOn");
            domClass.add("legend_" + obj.id, "legendOff");
          }
        }
      }
    },

    _showMenu: function (obj) {
      //show right click menu here
      alert("_showMenu");
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
      if (this.appConfig.theme.name === "BoxTheme" || this.appConfig.theme.name === "DartTheme" ||
        this.appConfig.theme.name === "LaunchpadTheme") {
        this.inherited(arguments);
      } else {
        var pos = {
          right: "0px",
          top: "0px",
          width: "50px",
          bottom: "0px"
        };
        this.position = pos;
        var style = utils.getPositionStyle(this.position);
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
      }

      this.popupSelectionChanged = null;
    },

    _clearChildNodes: function (parentNode) {
      while (parentNode.hasChildNodes()) {
        parentNode.removeChild(parentNode.lastChild);
      }
    }
  });
});
