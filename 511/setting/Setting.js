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

define([
    'dijit/registry',
    'dojo/query',
    "dojo/dom-construct",
    "jimu/dijit/ImageChooser",
    'dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Editor',
    'jimu/BaseWidgetSetting',
    'jimu/dijit/SimpleTable',
    'dijit/form/Button',
    'jimu/dijit/Message',
    "jimu/dijit/LoadingShelter",
    "dijit/TooltipDialog",
    "dijit/popup",
    'dojo/_base/lang',
    'dojo/on',
    'dojo/dom-class',
    'dojo/Deferred',
    "dojo/dom-style",
    "dojo/query",
    'dojo/_base/html',
    'dojo/_base/array',
    'dojo/sniff'
],
  function (
      registry,
      query,
      domConstruct,
      ImageChooser,
    declare,
    _WidgetsInTemplateMixin,
    Editor,
    BaseWidgetSetting,
    Table,
    Button,
    Message,
    LoadingShelter,
    TooltipDialog,
    dijitPopup,
    lang,
    on,
    domClass,
    Deferred,
    domStyle,
    query,
    html,
    array,
    has
    ) {
      return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
          baseClass: 'jimu-widget-511-setting',
          _layerInfos: null,
          _tableInfos: null,
          mpi: null,

          postCreate: function () {
          },

          startup: function () {
              this.inherited(arguments);

              if (!this.config.layerInfos) {
                  this.config.layerInfos = [];
              }
              this._layerInfos = [];
              this._tableInfos = [];

              //Thinking about moving these to the html to avoid the clutter below
              //var fields = [{ name: 'use', title: this.nls.useColumnText, width: '5px', type: 'checkbox', 'class': 'use' }, { name: 'upload', title: '', width: '5px', type: 'actions', 'class': 'upload', actions: ['edit'] }, { name: 'image', title: this.nls.iconColumnText, width: '8px', type: 'empty', hidden: false, 'class': 'imageTest' }, { name: 'imageData', title: '', type: 'text', hidden: true, width: '0px' }, { name: 'order', title: '', width: '5px', type: 'actions', 'class': 'order', actions: ['up', 'down'] }, { name: 'label', title: this.nls.nameText, width: '50px', type: 'text', editable: true, 'class': 'editText' }, { name: 'url', title: '', type: 'text', width: '0px', hidden: true }, { name: 'type', title: '', width: '15px', type: 'text', hidden: true }, { name: 'id', title: '', type: 'text', width: '0px', hidden: true }];

              var fields = [{
                  name: 'use',
                  title: this.nls.useColumnText,
                  width: '5px',
                  type: 'checkbox',
                  'class': 'use'
              }, {
                  name: 'upload',
                  title: '',
                  width: '5px',
                  type: 'actions',
                  'class': 'upload',
                  actions: ['edit']
              }, {
                  name: 'image',
                  title: this.nls.iconColumnText,
                  width: '8px',
                  type: 'empty',
                  hidden: false,
                  'class': 'imageTest'
              }, {
                  name: 'imageData',
                  title: '',
                  type: 'text',
                  hidden: true,
                  width: '0px'
              }, {
                  name: 'order',
                  title: '',
                  width: '5px',
                  type: 'actions',
                  'class': 'order',
                  actions: ['up', 'down']
              }, {
                  name: 'label',
                  title: this.nls.labelColumnText,
                  width: '50px',
                  type: 'text',
                  editable: true,
                  'class': 'editText'
              }, {
                  name: 'url',
                  title: '',
                  type: 'text',
                  width: '0px',
                  hidden: true
              }, {
                  name: 'type',
                  title: '',
                  width: '15px',
                  type: 'text',
                  hidden: true
              }, {
                  name: 'id',
                  title: '',
                  type: 'text',
                  width: '0px',
                  hidden: true
              }];

              var args = {
                  fields: fields,
                  selectable: false,
                  autoHeight: false
              };
              this.displayFieldsTable = new Table(args);
              this.displayFieldsTable.placeAt(this.tableLayerInfos);
              html.setStyle(this.displayFieldsTable.domNode, {
                  'height': '100%'
              });
              this.displayFieldsTable.startup();

              this.own(on(this.displayFieldsTable, 'actions-edit', lang.hitch(this, function (tr) {
                  var reader = new FileReader();
                  reader.onload = lang.hitch(this, function () {
                      //clear out any old values
                      //TODO...is this a vaid way to do this?
                      tr.cells[2].innerHTML = "<div></div>";
                      tr.cells[3].innerHTML = "<div></div>";

                      var a = domConstruct.create("div", {
                          class: "thumb2",
                          innerHTML: ['<img class="thumb2" src="', reader.result, '"/>'].join(''),
                          title: this.nls.iconColumnText
                      }, tr.cells[2]);

                      var r = this.displayFieldsTable.editRow(tr, { imageData: a.innerHTML });
                  });

                  this.fileInput.onchange = lang.hitch(this, function () {
                      var f = this.fileInput.files[0];
                      reader.readAsDataURL(f);
                  });

                  this.fileInput.click();
              }
              )));

              this.shelter = new LoadingShelter({
                  hidden: true
              });
              this.shelter.placeAt(this.domNode.parentNode.parentNode || this.domNode);
              this.shelter.startup();
              this.shelter.show();

              this.setConfig(this.config);
          },

          uploadImage: function () {
              var reader = new FileReader();
              reader.onload = lang.hitch(this, function () {
                  this.panelMainIcon.innerHTML = null;
                  this.mpi = reader.result;
                  domConstruct.create("div", {
                      innerHTML: ['<img class="t" src="', reader.result,
                                  '" title="', escape(this.nls.mainPanelIcon), '"/>'].join('')
                  }, this.panelMainIcon);
              });

              this.fileInput.onchange = lang.hitch(this, function () {
                  var f = this.fileInput.files[0];
                  reader.readAsDataURL(f);
              });

              this.fileInput.click();
          },

          setConfig: function (config) {
              this.config = config;
              this._initConfigProps();
              this.displayFieldsTable.clear();
              this._initLayers();
              if (this._layerInfos.length === 0) {
                  domStyle.set(this.tableEditInfosError, "display", "");
                  this.tableEditInfosError.innerHTML = this.nls.noLayers;
              } else {
                  domStyle.set(this.tableEditInfosError, "display", "none");
              }
              this.shelter.hide();
          },

          _initConfigProps: function () {
              this.cbxRefreshEnabled.onChange = lang.hitch(this, function (val) {
                  this.refreshInterval.disabled = !val;
                  this.refreshInterval.readOnly = !val;
              });

              if (typeof (this.config.refreshEnabled) !== 'undefined') {
                  this.cbxRefreshEnabled.checked = this.config.refreshEnabled;
              }

              if (!this.cbxRefreshEnabled.checked) {
                  this.refreshInterval.disabled = true;
                  this.refreshInterval.readOnly = true;
              }

              if (this.config.mainPanelText) {
                  this.mainPanelText.set('value', this.config.mainPanelText);
              }
              if (this.config.mainPanelIcon) {
                  this.panelMainIcon.innerHTML = this.config.mainPanelIcon;
              }

              if (this.config.refreshInterval) {
                  this.refreshInterval.set('value', this.config.refreshInterval);
              }
          },

          _initLayers: function () {
              //need the table to come in the correct order
              var layerIDs = [];
              var configLayers = [];
              var mapLayerIDs = this.map.graphicsLayerIds;
              if (typeof (this.config.layerInfos) !== 'undefined' && this.config.layerInfos.length > 0) {
                  for (var ii = 0; ii < this.config.layerInfos.length ; ii++) {
                      var id = this.config.layerInfos[ii].id;
                      //only add ID if it's in the map
                      if (mapLayerIDs.indexOf(id) > -1) {
                          configLayers.push(id);
                      }
                  }
                  for (var i = mapLayerIDs.length - 1; i >= 0; i--) {
                      var lID = mapLayerIDs[i];
                      //add layers that may have been added to the map after the config was written
                      if (!(configLayers.indexOf(lID) > -1)) {
                          configLayers.push(lID);
                      }
                  }
                  layerIDs = configLayers.reverse();
              } else {
                  layerIDs = this.map.graphicsLayerIds;
              }

              var len = layerIDs.length;
              for (var i = len - 1; i >= 0; i--) {
                  var layer = this.map.getLayer(layerIDs[i]);
                  if (layer.type === "Feature Layer") {
                      //get layerInfo from config if it exists...get it from the map layer if not
                      var layerInfo = this._getLayerInfoByID(layer, this.config.layerInfos);
                      this._layerInfos.push(layerInfo);

                      //TODO...see if I can get this where layerInfo would be a straight dump of the row
                      /// rather than creating this nearly duplicate object
                      var row = this.displayFieldsTable.addRow({
                          label: layerInfo.label,
                          url: layerInfo.url,
                          use: layerInfo.use,
                          imageData: layerInfo.imageData,
                          id: layerInfo.id,
                          type: layerInfo.type
                      });

                      if (layerInfo.imageData) {
                          domConstruct.create("div", {
                              class: "thumb2",
                              innerHTML: [layerInfo.imageData]
                          }, row.tr.cells[2]);
                      }
                  }
              }
          },

          _getLayerInfoByID: function (layer, layerinfos) {
              var label = this.getOperationalLayerTitle(layer);
              for (var i = 0; i < layerinfos.length; i++) {
                  var li = layerinfos[i];
                  if (li.id === layer.id) {
                      return li;
                  }
              }

              var newLayerInfo = {
                  label: label,
                  layer: layer,
                  use: false,
                  imageData: null,
                  type: layer.type,
                  url: layer.url,
                  id: layer.id
              };
              return newLayerInfo;
          },

          getOperationalLayerTitle: function (layer) {
              var title = "";
              if (this.appConfig.map && this.appConfig.map.operationallayers) {
                  var len = this.appConfig.map.operationallayers.length;
                  for (var i = 0; i < len; i++) {
                      if (this.appConfig.map.operationallayers[i].url.toLowerCase() ===
                        layer.url.toLowerCase()) {
                          title = this.appConfig.map.operationallayers[i].label;
                          break;
                      }
                  }
              }
              if (!title) {
                  title = layer.name;
              }
              if (!title) {
                  title = layer.id;
              }
              return title;
          },

          _destroyPopupDialog: function () {
              dijitPopup.close();
          },

          destroy: function () {
              alert("destroy");
              this.inherited(arguments);
          },

          onOpen: function () {
              if (!this.showing && this._isOnlyTable()) {
                  this._openTable();
              }
          },

          //When user click's 'OK'
          getConfig: function () {
              dijitPopup.close();

              //lookup layers data
              //don't think I need the extra loop since I have a field for all items I want data from
              var data = this.displayFieldsTable.getData();
              var table = [];
              if (this.config && this.config.layerInfos && this.config.layerInfos.length > 0) {
                  array.forEach(data, lang.hitch(this, function (tData, idx) {
                      tData = tData; // do nothing
                      var lInfo = this.config.layerInfos[idx];
                      var json = {};
                      json.label = data[idx].label;
                      json.id = data[idx].id;
                      json.type = data[idx].type;
                      json.use = data[idx].use;
                      json.imageData = data[idx].imageData;
                      json.url = data[idx].url;
                      table.push(json);
                  }));
              } else {
                  for (var i = 0; i < data.length; i++) {
                      var json = {};
                      json.label = data[i].label;
                      json.id = data[i].id;
                      json.type = data[i].type;
                      json.imageData = data[i].imageData;
                      json.use = data[i].use;
                      json.url = data[i].url;
                      table.push(json);
                  }
              }

              this.config.layerInfos = table;
              this.config.mainPanelText = this.mainPanelText.value;
              this.config.mainPanelIcon = this.panelMainIcon.innerHTML;
              this.config.refreshInterval = this.refreshInterval.value;
              this.config.refreshEnabled = this.cbxRefreshEnabled.checked;

              return this.config;
          },

          destroy: function () {
              this._destroyPopupDialog();

              this.inherited(arguments);
          }

      });
  });