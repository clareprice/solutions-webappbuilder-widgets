///////////////////////////////////////////////////////////////////////////
// Copyright � 2014 Esri. All Rights Reserved.
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
    'dojo/dom-construct',
    'jimu/dijit/ImageChooser',
    'dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Editor',
    'jimu/BaseWidgetSetting',
    'jimu/dijit/SimpleTable',
    'jimu/LayerInfos/LayerInfos',
    'dijit/form/Button',
    'dijit/form/Select',
    'dijit/form/ValidationTextBox',
    'dijit/form/CheckBox',
    'jimu/dijit/LoadingShelter',
    'jimu/dijit/Popup',
    'jimu/utils',
    'esri/request',
    'esri/symbols/jsonUtils',
    'dijit/popup',
    'dojo/_base/lang',
    'dojo/DeferredList',
    'dojo/on',
    'dojox/gfx',
    'dojo/dom-class',
    'dojo/Deferred',
    'dojo/dom-style',
    'dojo/query',
    'dojo/_base/html',
    'dojo/_base/array',
    'dojo/sniff',
    './MySymbolPicker'
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
    LayerInfos,
    Button,
    Select,
    ValidationTextBox,
    CheckBox,
    LoadingShelter,
    Popup,
    utils,
    esriRequest,
    jsonUtils,
    dijitPopup,
    lang,
    DeferredList,
    on,
    gfx,
    domClass,
    Deferred,
    domStyle,
    query,
    html,
    array,
    has,
    SymbolPicker
    ) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-511-setting',
      _layerInfos: null,
      _tableInfos: null,
      mpi: null,
      layer_options: [],
      refreshLayers: [],
      geomTypeResults: [],
      hasUpdatedInfo: false,
      hasError: false,

      postCreate: function () {
        this.inherited(arguments);
        this._getAllLayers();
        this.own(on(this.btnAddLayer, 'click', lang.hitch(this, this._addLayerRow)));
        this.own(on(this.layerTable, 'actions-edit', lang.hitch(this, this._pickSymbol)));
      },

      startup: function () {
        this.inherited(arguments);
      },

      _getAllLayers: function () {
        if (this.map.itemId) {
          LayerInfos.getInstance(this.map, this.map.itemInfo)
            .then(lang.hitch(this, function (operLayerInfos) {
              this.opLayers = operLayerInfos;
              this._setLayers();
              this.setConfig(this.config);
            }));
        }
      },

      _setLayers: function () {
        //TODO This is also overly redundant
        var options = [];
        for (var i = 0; i < this.opLayers._layerInfos.length; i++) {
          var OpLyr = this.opLayers._layerInfos[i];
          if (OpLyr.newSubLayers.length > 0) {
            this._recurseOpLayers(OpLyr.newSubLayers, options);
          } else if (OpLyr.featureCollection) {
            if (OpLyr.layers.length > 1) {
              this._recurseOpLayers(OpLyr.layers, options);
            }
          } else if (OpLyr.originOperLayer) {
            var OpLyr2 = OpLyr.originOperLayer;
            if (OpLyr2.featureCollection) {
              if (OpLyr2.featureCollection.layers.length > 1) {
                this._recurseOpLayers(OpLyr2.featureCollection.layers, options);
              } else {
                options.unshift({
                  label: OpLyr.title,
                  value: OpLyr.title,
                  url: undefined,
                  imageData: OpLyr.imageData,
                  id: OpLyr.id,
                  geometryType: OpLyr2.featureCollection.layers[0].layerObject.geometryType,
                  type: OpLyr.type,
                  renderer: OpLyr2.featureCollection.layers[0].layerObject.renderer,
                  itemId: OpLyr2.itemId
                });
              }
            } else {
              if (typeof (OpLyr.layerObject.geometryType) === 'undefined') {
                this.setGeometryType(OpLyr.layerObject);
              }
              options.unshift({
                label: OpLyr.title,
                value: OpLyr.title,
                url: OpLyr.layerObject.url,
                imageData: OpLyr.imageData,
                id: OpLyr.id,
                type: OpLyr.type,
                renderer: OpLyr.layerObject.renderer,
                geometryType: OpLyr.layerObject.geometryType
              });
            }
          } else {
            if (typeof (OpLyr.layerObject.geometryType) === 'undefined') {
              this.setGeometryType(OpLyr.layerObject);
            }
            options.unshift({
              label: OpLyr.title,
              value: OpLyr.title,
              url: OpLyr.layerObject.url,
              imageData: OpLyr.imageData,
              id: OpLyr.id,
              type: OpLyr.type,
              renderer: OpLyr.layerObject.renderer,
              geometryType: OpLyr.layerObject.geometryType
            });
          }
        }
        this.layer_options = lang.clone(options);
      },

      setConfig: function (config) {
        this.config = config;

        if (this.config.mainPanelText) {
          this.mainPanelText.set('value', this.config.mainPanelText);
        }
        if (this.config.mainPanelIcon) {
          this.panelMainIcon.innerHTML = this.config.mainPanelIcon;
        }

        if (this.config.refreshInterval) {
          this.refreshInterval.set('value', this.config.refreshInterval);
        }

        if (this.config.loadStaticData) {
          this.chkStatic.set('value', this.config.loadStaticData);
        }

        this.layerTable.clear();
        this.isInitalLoad = true;
        this.layerLoadCount = 0;
        for (var i = 0; i < this.config.layerInfos.length; i++) {
          var lyrInfo = this.config.layerInfos[i];
          this._populateLayerRow(lyrInfo);
          this.layerLoadCount += 1;
        }
      },

      _addLayerRow: function () {
        this.isInitalLoad = false;
        var result = this.layerTable.addRow({});
        if (result.success && result.tr) {
          var tr = result.tr;
          this._addLayersOption(tr);
          this._addLabelOption(tr);
          this._addRefreshOption(tr);
          this._addDefaultSymbol(tr);
        }
      },

      _populateLayerRow: function (lyrInfo) {
        var result = this.layerTable.addRow({});
        if (result.success && result.tr) {
          var tr = result.tr;
          this._addLayersOption(tr);
          this._addLabelOption(tr);
          this._addRefreshOption(tr);
          tr.selectLayers.set("value", lyrInfo.layer);
          tr.labelText.set("value", lyrInfo.label);
          tr.refreshBox.set("checked", lyrInfo.refresh);

          var a = domConstruct.create("div", {
            class: "imageDataGFX",
            innerHTML: [lyrInfo.imageData],
            title: this.nls.iconColumnText
          }, tr.cells[3]);

          var cLo = this._getLayerOptionByValue(lyrInfo.layer);
          cLo.filter = lyrInfo.filter;
          cLo.imageData = lyrInfo.imageData;
          cLo.symbolData = lyrInfo.symbolData;
        }
      },

      _addLayersOption: function (tr) {
        var lyrOptions = lang.clone(this.layer_options);
        var td = query('.simple-table-cell', tr)[0];
        if (td) {
          html.setStyle(td, "verticalAlign", "middle");
          var tabLayers = new Select({
            style: {
              width: "100%",
              height: "28px"
            },
            options: lyrOptions
          });
          tabLayers.placeAt(td);
          tabLayers.startup();
          tr.selectLayers = tabLayers;
          this.own(on(tabLayers, 'change', lang.hitch(this, function (v) {
            if (!this.isInitalLoad) {
              this._addDefaultSymbol(tr);
            }

            this.layerLoadCount -= 1;
            if (this.layerLoadCount === 1) {
              this.isInitalLoad = false;
            }
          })));
        }
      },

      _addLabelOption: function (tr) {
        var td = query('.simple-table-cell', tr)[1];
        html.setStyle(td, "verticalAlign", "middle");
        var labelTextBox = new ValidationTextBox({
          style: {
            width: "100%",
            height: "28px"
          }
        });
        labelTextBox.placeAt(td);
        labelTextBox.startup();
        tr.labelText = labelTextBox;
      },

      _addRefreshOption: function (tr) {
        //TODO disable for everything but feature collections

        var td = query('.simple-table-cell', tr)[4];
        html.setStyle(td, "verticalAlign", "middle");
        this.currentTR = tr;
        var refreshCheckBox = new CheckBox({
          onChange: lang.hitch(this, function (v) {
            var value = this.currentTR.selectLayers.value;
            if (v) {
              var lyrInfo = this._getLayerOptionByValue(value);
              this.refreshLayers.push(value);
              var rO = query('.refreshOff', this.refreshOptions.domNode)[0];
              if (rO) {
                html.removeClass(rO, 'refreshOff');
                html.addClass(rO, 'refreshOn');
              }
              if (!this.refreshInterval.isValid()) {
                this._disableOk();
              }
            } else {
              var i = this.refreshLayers.indexOf(value);
              if (i > -1) {
                this.refreshLayers.splice(i, 1);
                if (this.refreshLayers.length === 0) {
                  var rO = query('.refreshOn', this.refreshOptions.domNode)[0];
                  if (rO) {
                    html.removeClass(rO, 'refreshOn');
                    html.addClass(rO, 'refreshOff');
                  }
                  this._enableOk();
                }
              }
            }
          })
        });
        refreshCheckBox.placeAt(td);
        refreshCheckBox.startup();
        tr.refreshBox = refreshCheckBox;
      },

      _updateOK: function () {
        if (this.refreshInterval.isValid()) {
          this._enableOk();
        } else {
          this._disableOk();
        }
      },

      _disableOk: function () {
        var s = query(".button-container")[0];
        var s2 = s.children[2];
        var s3 = s.children[3];
        domStyle.set(s2, "display", "none");
        domStyle.set(s3, "display", "inline-block");
      },

      _enableOk: function () {
        var s = query(".button-container")[0];
        var s2 = s.children[2];
        var s3 = s.children[3];
        domStyle.set(s2, "display", "inline-block");
        domStyle.set(s3, "display", "none");
      },

      _addDefaultSymbol: function (tr) {
        var td = query('.simple-table-cell', tr)[0];
        this.curRow = tr;
        if (td) {
          var lo = this._getLayerOptionByValue(td.children[0].textContent);
          var selectLayersValue = tr.selectLayers.value;

          var hasSymbolData = false;
          var sd;
          if (typeof (this.curRow.symbolData) !== 'undefined') {
            sd = this.curRow.symbolData;
            hasSymbolData = sd.userDefinedSymbol && (sd.layerId === selectLayersValue);
          }

          if (!hasSymbolData || typeof (lo.symbolData) === 'undefined') {
            var options = {
              nls: this.nls,
              callerRow: tr,
              layerInfo: lo,
              value: selectLayersValue,
              symbolInfo: hasSymbolData ? this.curRow.symbolData : lo.symbolData,
              map: this.map,
              ac: this.appConfig
            };
            var sourceDijit = new SymbolPicker(options);
            sourceDijit._setSymbol();

            this.curRow.cells[3].innerHTML = "<div></div>";
            this.curRow.symbolData = sourceDijit.symbolInfo;

            var newDiv = this._createImageDataDiv(this.curRow.symbolData.icon);
            var r = this.layerTable.editRow(this.curRow, {
              imageData: newDiv.innerHTML
            });

            this.curRow = null;
            sourceDijit.destroy();
            sourceDijit = null;
          } else {
            this.curRow.cells[3].innerHTML = "<div></div>";
            this.curRow.symbolData = lo.symbolData;

            var newDiv = this._createImageDataDiv(this.curRow.symbolData.icon);
            var r = this.layerTable.editRow(this.curRow, {
              imageData: newDiv.innerHTML
            });
          }
        }
      },

      _getLayerOptionByValue: function (value) {
        for (var i = 0; i < this.layer_options.length; i++) {
          var lo = this.layer_options[i];
          if (lo.value === value) {
            return lo;
          }
        }
      },

      _getLayerOptionByURL: function (url) {
        for (var i = 0; i < this.layer_options.length; i++) {
          var lo = this.layer_options[i];
          if (lo.url === url) {
            return lo;
          }
        }
      },

      _recurseOpLayers: function (pNode, pOptions) {
        var nodeGrp = pNode;
        array.forEach(nodeGrp, lang.hitch(this, function (Node) {
          if (Node.newSubLayers.length > 0) {
            this._recurseOpLayers(Node.newSubLayers, pOptions);
          } else if (Node.featureCollection) {
            if (Node.layers.length > 1) {
              this._recurseOpLayers(Node.layers, pOptions);
            }
          } else {

            if (typeof (Node.layerObject) !== 'undefined') {
              if (typeof (Node.layerObject.geometryType) === 'undefined') {
                this.setGeometryType(Node.layerObject);
              }
            }
            var OpLyr2;
            var w;
            if (Node.hasOwnProperty("parentLayerInfo")) {
              if (Node.parentLayerInfo.hasOwnProperty("originOperLayer")) {
                OpLyr2 = Node.parentLayerInfo.originOperLayer;
              }
            }

            var u;
            var subLayerId;
            if (Node.layerObject) {
              if (Node.layerObject.url) {
                u = Node.layerObject.url;
                subLayerId = parseInt(u.substr(u.lastIndexOf('/') + 1));
              }
            }

            pOptions.push({
              label: Node.title,
              value: Node.title,
              url: u,
              imageData: Node.imageData,
              id: Node.id,
              type: Node.type,
              itemId: OpLyr2 ? OpLyr2.itemId : undefined,
              renderer: Node.layerObject.renderer,
              geometryType: Node.layerObject.geometryType,
              subLayerId: subLayerId
            });
          }
        }));
      },

      _pickSymbol: function (tr) {
        var selectLayersValue = tr.selectLayers.value;
        var lo = this._getLayerOptionByValue(selectLayersValue);
        this.curRow = tr;

        var options = {
          nls: this.nls,
          callerRow: tr,
          layerInfo: lo,
          value: selectLayersValue,
          symbolInfo: typeof (this.curRow.symbolData) !== 'undefined' ? this.curRow.symbolData : lo.symbolData,
          map: this.map,
          ac: this.appConfig
        };
        var sourceDijit = new SymbolPicker(options);

        var popup = new Popup({
          width: 625,
          autoHeight: true,
          content: sourceDijit,
          titleLabel: this.nls.sympolPopupTitle
        });

        this.own(on(sourceDijit, 'ok', lang.hitch(this, function (data) {
          this.curRow.cells[3].innerHTML = "<div></div>";
          this.curRow.symbolData = data;

          var newDiv = this._createImageDataDiv(data.icon);
          var r = this.layerTable.editRow(this.curRow, {
            imageData: newDiv.innerHTML
          });

          this.curRow = null;
          sourceDijit.destroy();
          sourceDijit = null;
          popup.close();
        })));

        this.own(on(sourceDijit, 'cancel', lang.hitch(this, function () {
          this.curRow = null;
          sourceDijit.destroy();
          sourceDijit = null;
          popup.close();
        })));
      },

      _createImageDataDiv: function (sym) {
        var symbol = jsonUtils.fromJson(sym);

        if (!symbol) {
          symbol = sym;
        }

        var a;
        //TODO...should I avoid hard coding these??
        if (symbol) {
          var isSVG = false;
          if (typeof (symbol.setWidth) !== 'undefined') {
            if (typeof (symbol.setHeight) !== 'undefined') {
              symbol.setWidth(27);
              symbol.setHeight(27);
            } else {
              symbol.setWidth(2);
            }
          } else if (typeof (symbol.size) !== 'undefined') {
            if (symbol.size > 20) {
              symbol.setSize(20);
            }
          } else {
            isSVG = true;
          }
          if (isSVG) {
            a = domConstruct.create("div", {
              class: "imageDataGFX",
              innerHTML: [symbol],
              title: this.nls.iconColumnText
            }, this.curRow.cells[3]);
          } else {
            a = domConstruct.create("div", { class: "imageDataGFX" }, this.curRow.cells[3]);
            var mySurface = gfx.createSurface(a, 28, 28);
            var descriptors = jsonUtils.getShapeDescriptors(symbol);
            var shape = mySurface.createShape(descriptors.defaultShape)
                          .setFill(descriptors.fill)
                          .setStroke(descriptors.stroke);
            shape.applyTransform({ dx: 14, dy: 14 });
          }
        } else if (typeof (sym.url) !== 'undefined') {
          a = domConstruct.create("div", { class: "imageDataGFX" }, this.curRow.cells[3]);
          domStyle.set(a, "background-image", "url(" + sym.url + ")");
          domStyle.set(a, "background-repeat", "no-repeat");
        }
        return a;
      },

      //TODO...need to ensure that we have the geometry type...when this is done
      //should remove this query from the widget
      setGeometryType: function (OpLayer) {
        var queries = [];
        if (typeof (OpLayer.url) !== 'undefined') {
          if (OpLayer.url.indexOf("MapServer")) {
            queries.push(esriRequest({ "url": OpLayer.url + "?f=json" }));
          }
        }

        if (queries.length > 0) {
          var queryList = new DeferredList(queries);
          queryList.then(lang.hitch(this, function (queryResults) {
            if (queryResults) {
              if (queryResults.length > 0) {
                var resultInfo = queryResults[0][1];
                if (this.layer_options[resultInfo.id].value === resultInfo.name) {
                  //TODO...need to loop through the results and find the match if this condition is not hit
                  //...not sure this would ever be the case but better safe than sorry
                  this.layer_options[resultInfo.id].geometryType = resultInfo.geometryType;
                  if (typeof (resultInfo.drawingInfo) !== 'undefined') {
                    this.layer_options[resultInfo.id].renderer = resultInfo.drawingInfo.renderer;
                    this.layer_options[resultInfo.id].drawingInfo = resultInfo.drawingInfo;

                    //Also need the OID field and fields
                    this.layer_options[resultInfo.id].fields = resultInfo.fields;

                    var f;
                    for (var i = 0; i < resultInfo.fields.length; i++) {
                      f = resultInfo.fields[i];
                      if (f.type === "esriFieldTypeOID") {
                        break
                      }
                    }
                    this.layer_options[resultInfo.id].oidFieldName = f;
                  }
                } else {
                  console.log("IDs don't match!");
                }
              }
            }
          }));
        }
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

      getConfig: function () {
        dijitPopup.close();

        var rows = this.layerTable.getRows();
        var table = [];
        var lInfo;
        array.forEach(rows, lang.hitch(this, function (tr) {
          var selectLayersValue = tr.selectLayers.value;

          var labelTextValue = utils.sanitizeHTML(tr.labelText.value);
          var refreshBox = tr.refreshBox;
          var lo = this._getLayerOptionByValue(selectLayersValue);

          lInfo = {
            layer: selectLayersValue,
            label: labelTextValue !== "" ? labelTextValue : selectLayersValue,
            refresh: refreshBox.checked,
            url: lo.url,
            type: lo.type,
            id: lo.id,
            symbolData: tr.symbolData ? tr.symbolData : lo.symbolData,
            geometryType: lo.geometryType,
            itemId: lo.itemId,
            renderer: lo.renderer,
            drawingInfo: lo.drawingInfo,
            fields: lo.fields,
            oidFieldName: lo.oidFieldName,
            subLayerId: lo.subLayerId
          };

          var td = query('.imageDataGFX', tr)[0];
          lInfo.imageData = typeof (td) !== 'undefined' ? td.innerHTML : "<div></div>";
          table.push(lInfo);
        }));

        this.config.layerInfos = table;
        this.config.mainPanelText = utils.sanitizeHTML(this.mainPanelText.value);
        this.config.mainPanelIcon = this.panelMainIcon.innerHTML;
        this.config.refreshInterval = utils.sanitizeHTML(this.refreshInterval.value);
        this.config.refreshEnabled = this.refreshLayers.length > 0 ? true : false;

        return this.config;
      },

      destroy: function () {
        dijitPopup.close();
        this.inherited(arguments);
      }
    });
  });
