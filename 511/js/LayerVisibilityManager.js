///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
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
  'dojo/_base/array',
  'dojo/topic',
  'dojo/on',
  'jimu/LayerInfos/LayerInfos'
], function (declare, lang, array, topic, on, LayerInfos) {
  var layerVisibilityManager = declare(null, {
    _layerList: {},
    _map: null,
    _initalLayerVisibility: {},
    _opLayers: null,
    _parent: null,

    //need to know the right time to get the map
    //and hook to map changed event...if I even need to
    //listen to layer changed events

    //not sure if I will listen to app config changed here or do it like the ThemeColorManager and just call methods from the object
    // and only listen to app config changes in the widget

    constructor: function (options) {
      this._map = options.map;
      this._layerList = options.configLayerList;
      this._parent = options.parent;
      this.setOpLayers(this._map);
      this.storeInitalVisibility();
      this.setLayerVisibility(this._initalLayerVisibility, true);
    },

    setOpLayers: function (map) {
      if (map.itemId) {
        LayerInfos.getInstance(map, map.itemInfo)
          .then(lang.hitch(this, function (operLayerInfos) {
            this._opLayers = operLayerInfos;
          }));
      }
    },

    storeInitalVisibility: function () {
      //capture the inital visible state of all layers
      // visibility will be turned off when the widget opens and we want to set them back 
      // to the inital state when the widget is closed
      this._initalLayerVisibility = {}
      array.forEach(this._opLayers._operLayers, lang.hitch(this, function (layer) {
        if (layer.layerType === "ArcGISFeatureLayer" || layer.layerType === "ArcGISMapServiceLayer" || typeof (layer.layerType) === 'undefined') {
          if (layer.layerObject && this.shouldCheck(layer)) {
            this._initalLayerVisibility[layer.id] = {
              type: layer.layerType,
              layerObject: layer.layerObject,
              visible: layer.layerObject.visible
            };
          } else if (layer.featureCollection) {
            for (var i = 0; i < layer.featureCollection.layers.length; i++) {
              var lyr = layer.featureCollection.layers[i];
              if (this.shouldCheck(lyr)) {
                this._initalLayerVisibility[lyr.id] = {
                  type: lyr.layerType,
                  layerObject: lyr.layerObject,
                  visible: lyr.layerObject.visible,
                  pl: layer
                };
              }
            }
          }
        }
      }));
    },

    shouldCheck: function (l) {
      //this.layerList is a list configured layers similar in structure to the initalLayerVisibility
      // {key: <LayerID>, values: { type: <LayerTypeString>, layerObject: <LayerInstance>, visible: <bool>}}
      return this._layerList ? !(l.id in this._layerList) : true;
    },

    setLayerVisibility: function (lyrs, auto) {
      //if auto is true all layers will be marked as visible false
      //if auto is false all layers will set to the inital visibility captured onOpen
      // expectes the layers object to be {key: <LayerID>, values: { type: <LayerTypeString>, layerObject: <LayerInstance>, visible: <bool>}}
      if (lyrs) {
        for (var key in lyrs) {
          var l = lyrs[key];
          if (typeof (l.pl) === 'undefined') {
            l.layerObject.setVisibility(auto ? false : l.visible);
          }
          //else if (l.pl.parentLayerInfo) {
          //  //TODO this may not be necessary if I can get and add the correct LO to the layerList
          //  l.pl.parentLayerInfo.layerObject.setVisibility(auto ? false : l.visible);
          //}
        else {
            l.layerObject.setVisibility(auto ? false : l.visible);
            l.pl.visibility = auto ? false : l.visible;
          }
        }
        //TODO need to understand how to make LayerList update
      }
    },

    resetLayerVisibility: function () {
      //return layers to the inital visible state
      this.setLayerVisibility(this._initalLayerVisibility, false);
      this._initalLayerVisibility = {};
      var clusterLayers = {};
      for (var key in this._layerList) {
        if (this._layerList[key].type === "ClusterLayer" || this._layerList[key].type === "FeatureCollectionLayer") {
          clusterLayers[key] = this._layerList[key];
        }
      }
      if (Object.keys(clusterLayers).length > 0) {
        this.setLayerVisibility(clusterLayers, true);
      }
    }
  });

  return layerVisibilityManager;
});