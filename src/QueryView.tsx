import * as React from 'react';
import Container from '@mui/material/Container';
import { Button, CircularProgress, FormControl, Grid, InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme } from '@mui/material'
import { DimensionChip, AddDimensionChip, FilterChip, AddFilterChip, MeasuresChip } from './QueryViewChips';
import { ResponsiveLine } from '@nivo/line';
import { observer } from 'mobx-react-lite';
import { apiBaseUrl } from "./configs";
import { useRootStore } from './RootStore';
import { ButtonChip, SelectionChip } from './GenericChips';
import { runInAction } from 'mobx';
import { useEffect, useState } from 'react';
import { grpc } from '@improbable-eng/grpc-web';
import { CuboidDimension, DeleteFilterArgs, Empty, GetCubesResponse, GetFiltersResponse, GetPreparedCuboidsArgs, GetPreparedCuboidsResponse, QueryArgs, QueryResponse, SelectDataCubeArgs, SelectDataCubeForQueryResponse } from './_proto/sudokubeRPC_pb';
import { SudokubeService } from './_proto/sudokubeRPC_pb_service';
import { buildMessage } from './Utils';
import { cuboidToRow } from './MaterializationView';
import MaterialReactTable, { MRT_ColumnDef } from 'material-react-table';
import { format } from 'd3-format';
import { ScaleValue } from '@nivo/scales/dist/types/types';

export default observer(function Query() {
  const { queryStore: store, errorStore } = useRootStore();
  useEffect(() => {
    grpc.unary(SudokubeService.getDataCubesForQuery, {
      host: apiBaseUrl,
      request: new Empty(),
      onEnd: response => {
        if (response.status !== 0) {
          runInAction(() => {
            errorStore.errorMessage = response.statusMessage;
            errorStore.isErrorPopupOpen = true;
            store.isCubeLoadingFailed = true;
          });
          return;
        }
        runInAction(() => {
          store.cubes = (response.message as GetCubesResponse)?.getCubesList();
          store.cube = store.cubes[0];
        });
        grpc.unary(SudokubeService.selectDataCubeForQuery, {
          host: apiBaseUrl,
          request: buildMessage(new SelectDataCubeArgs(), {cube: store.cube}),
          onEnd: response => runInAction(() => {
            if (response.status !== 0) {
              runInAction(() => {
                errorStore.errorMessage = response.statusMessage;
                errorStore.isErrorPopupOpen = true;
              });
              return;
            }
            const message = response.message as SelectDataCubeForQueryResponse;
            runInAction(() => {
              store.dimensionHierarchy = message.getDimHierarchyList();
              store.dimensions = message.getCuboidDimsList();
              store.measures = message.getMeasuresList();
              store.measure = store.measures[0];
              store.measure2 = store.measures[0];
              store.isCubeLoaded = true;
            });
          })
        });
      }
    });
  }, []);
  return (
    <Container style = {{ padding: '20px 0px' }}>
      <SelectCube/>
      <QueryParams/>
      <Cuboids isShown = {store.showResults}/>
      <Chart isShown = {store.showResults} hasBounds = { store.solver === 'Linear Programming' }/>
      <Metrics isShown = {store.showResults}/>
    </Container>
  )
})

const SelectCube = observer(() => {
  const { queryStore: store, errorStore } = useRootStore();
  return (
    <div style = {{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
      <FormControl sx = {{ minWidth: 200 }}>
        <InputLabel htmlFor = "select-cube">Select Cube</InputLabel>
        <Select
          id = "select-cube" label = "Select Cube"
          size = 'small'
          value = { store.cube }
          onChange = { e => {
            runInAction(() => {
              store.cube = e.target.value;
              store.isCubeLoaded = false;
              store.isCubeLoadingFailed = false;
              store.horizontal = [];
              store.series = [];
              store.filters = [];
            });
            grpc.unary(SudokubeService.selectDataCubeForQuery, {
              host: apiBaseUrl,
              request: buildMessage(new SelectDataCubeArgs(), {cube: store.cube}),
              onEnd: response => runInAction(() => {
                if (response.status !== 0) {
                  runInAction(() => {
                    errorStore.errorMessage = response.statusMessage;
                    errorStore.isErrorPopupOpen = true;
                    store.isCubeLoadingFailed = true;
                  });
                  return;
                }
                const message = response.message as SelectDataCubeForQueryResponse;
                runInAction(() => {
                  store.dimensionHierarchy = message.getDimHierarchyList();
                  store.dimensions = message.getCuboidDimsList();
                  store.measures = message.getMeasuresList();
                  store.measure = store.measures[0];
                  store.isCubeLoaded = true;
                  store.showResults = false; // Hide the results
                });
              })
            });
          } }>
          { store.cubes.map(cube => (
            <MenuItem key = { 'select-cube-' + cube } value = {cube}>{cube}</MenuItem>
          )) }
        </Select>
      </FormControl>

      <span
        hidden = { store.isCubeLoaded || store.isCubeLoadingFailed }
        style = {{ verticalAlign: 'middle', marginLeft: 10 }} 
      >
        <CircularProgress size = '1.5rem' style = {{ verticalAlign: 'middle' }} />
      </span>
    </div> 
  );
})

const QueryParams = observer(() => {
  const { queryStore: store, errorStore } = useRootStore();
  const [solver, setSolver] = useState(store.solver);
  const hasTwoMeasures = store.aggregation === 'REG' || store.aggregation === 'COR';
  return (
    <Grid container maxHeight='30vh' overflow='scroll' style={{ paddingTop: '1px', paddingBottom: '1px' }}>
      <Horizontal/>
      <Filters/>
      <Series/>
      <Grid item xs={6}>
        <MeasuresChip 
          measure1 = { store.measure }
          measure2 = { hasTwoMeasures ? store.measure2 : undefined }
          measures = { store.measures }
          onChange1 = { v => runInAction(() => store.measure = v) }
          onChange2 = { hasTwoMeasures ? v => runInAction(() => store.measure2 = v) : undefined }
        />
        <SelectionChip 
          keyText = 'Aggregation' 
          valueText = { store.aggregation } 
          valueRange = { store.aggregations } 
          disabled = { !store.isCubeLoaded }
          onChange = { v => runInAction(() => store.aggregation = v) }
        />
        <SelectionChip 
          keyText = 'Solver' 
          valueText = { solver } 
          valueRange = { store.solvers } 
          disabled = { !store.isCubeLoaded }
          onChange = { setSolver }
        />
        <SelectionChip
          keyText = 'Mode'
          valueText = { store.mode }
          valueRange = { store.modes }
          disabled = { !store.isCubeLoaded }
          onChange = { v => runInAction(() => store.mode = v) }
        />
        <ButtonChip 
          label = {
            <span>
              <span>Run</span>
              <span
                hidden = { !store.isInitialResultLoading }
              >
                <CircularProgress size='0.8rem' color = 'secondary' style = {{ verticalAlign: 'middle' }} />
              </span>
            </span>
          }
          variant = 'filled' 
          onClick = {() => {
            runInAction(() => store.isInitialResultLoading = true);
            grpc.unary(SudokubeService.startQuery, {
              host: apiBaseUrl,
              request: buildMessage(new QueryArgs(), {
                horizontalList: store.horizontal.map(dimension => buildMessage(new QueryArgs.DimensionDef(), {
                  dimensionName: store.dimensionHierarchy[dimension.dimensionIndex].getDimName(),
                  dimensionLevel: store.dimensionHierarchy[dimension.dimensionIndex].getLevelsList()[dimension.dimensionLevelIndex]
                })),
                seriesList: store.series.map(dimension => buildMessage(new QueryArgs.DimensionDef(), {
                  dimensionName: store.dimensionHierarchy[dimension.dimensionIndex].getDimName(),
                  dimensionLevel: store.dimensionHierarchy[dimension.dimensionIndex].getLevelsList()[dimension.dimensionLevelIndex]
                })),
                measure: store.measure,
                measure2: hasTwoMeasures ? store.measure2 : undefined,
                aggregation: store.aggregation,
                solver: solver,
                isBatchMode: store.mode === 'Batch',
                preparedCuboidsPerPage: store.cuboidsPageSize
              }),
              onEnd: res => {
                runInAction(() => {
                  store.isInitialResultLoading = false;
                  store.solver = solver;
                });
                if (res.status !== 0) {
                  runInAction(() => {
                    errorStore.errorMessage = res.statusMessage;
                    errorStore.isErrorPopupOpen = true;
                  });
                  return;
                }
                const message = res.message as QueryResponse;
                runInAction(() => {
                  store.cuboidsPage = store.currentCuboidPage = message.getCuboidsPageId();
                  store.preparedCuboids = message.getCuboidsList();
                  store.currentCuboidIdWithinPage = message.getCurrentCuboidIdWithinPage();
                  store.isQueryComplete = message.getIsComplete();
                  store.result = { data: message.getSeriesList().map(seriesData => ({
                    id: seriesData.getSeriesName(),
                    data: seriesData.getDataList().map(point => point.toObject())
                  })) };
                  store.metrics = message.getStatsList().map(stat => stat.toObject());
                  store.showResults = true;
                })
              }
            })
          }}
          disabled = { !store.isCubeLoaded }
        />
      </Grid>
    </Grid>
  )
});

const Horizontal = observer(() => {
  const { queryStore: store } = useRootStore();
  return (
    <Grid item xs={6}>
      { store.horizontal.map((d, i) => (<DimensionChip
        key = {'horizontal-' + d.dimensionIndex + '-' + d.dimensionLevelIndex}
        type = 'Horizontal'
        text = {
          store.dimensionHierarchy[d.dimensionIndex].getDimName() 
            + ' / ' 
            + store.dimensionHierarchy[d.dimensionIndex].getLevelsList()[d.dimensionLevelIndex]
        }
        zoomIn = { () => store.zoomInHorizontal(i) }
        zoomOut = { () => store.zoomOutHorizontal(i) }
        onDelete = { () => runInAction(() => store.horizontal.splice(i, 1)) }
      />)) }
      <AddDimensionChip type='Horizontal' />
    </Grid>
  )
});

const Filters = observer(() => {
  const { queryStore: store, errorStore } = useRootStore();
  return (
    <Grid item xs={6}>
      { store.filters.map((d, i) => (<FilterChip
        key = {'filter-' + d.getDimensionName() + '-' + d.getDimensionLevel() + '-' + d.getValues()}
        text = { d.getDimensionName() + ' / ' + d.getDimensionLevel() + ' = ' + d.getValues() }
        onDelete = { () => {
          grpc.unary(SudokubeService.deleteFilter, {
            host: apiBaseUrl,
            request: buildMessage(new DeleteFilterArgs(), { index: i }),
            onEnd: response => {
              if (response.status !== 0) {
                runInAction(() => {
                  errorStore.errorMessage = response.statusMessage;
                  errorStore.isErrorPopupOpen = true;
                });
                return;
              }
              grpc.unary(SudokubeService.getFilters, {
                host: apiBaseUrl,
                request: new Empty(),
                onEnd: (response => {
                  if (response.status !== 0) {
                    runInAction(() => {
                      errorStore.errorMessage = response.statusMessage;
                      errorStore.isErrorPopupOpen = true;
                    });
                    return;
                  }
                  runInAction(() => 
                    store.filters = (response.message as GetFiltersResponse).getFiltersList()
                  );
                })
              });
            }
          })
        } }
      />)) }
      <AddFilterChip/>
    </Grid>
  )
});

const Series = observer(() => {
  const { queryStore } = useRootStore();
  const dimensions = queryStore.dimensionHierarchy;
  return (
    <Grid item xs={6}>
      { queryStore.series.map((d, i) => (
        <DimensionChip
          key = {'series-' + d.dimensionIndex + '-' + d.dimensionLevelIndex}
          type = 'Series'
          text = {
            dimensions[d.dimensionIndex].getDimName()
              + ' / ' 
              + dimensions[d.dimensionIndex].getLevelsList()[d.dimensionLevelIndex]
          }
          zoomIn = { () => queryStore.zoomInSeries(i) }
          zoomOut = { () => queryStore.zoomOutSeries(i) }
          onDelete = { () => runInAction(() => queryStore.series.splice(i, 1)) }
        />
      )) }
      <AddDimensionChip type='Series' />
    </Grid>
  );
});

const Cuboids = observer(({isShown}: {isShown: boolean}) => {
  const { queryStore: store, errorStore } = useRootStore();
  if (!isShown) {
    return null;
  }
  return ( <div>
    <h3>Prepared Cuboids</h3>
    <div style = {{ marginTop: 20 }}>
      <MaterialReactTable
        columns = { store.dimensions.map(dimensionToColumn) }
        enableColumnResizing
        data = { store.preparedCuboids.map(cuboidToRow) }
        getRowId = { row => row.id }
        muiTableBodyRowProps = {({row}) => ({
          sx: {
            backgroundColor: 
              (store.cuboidsPage === store.currentCuboidPage 
                && row.index === store.currentCuboidIdWithinPage)
                ? '#f5fbfe'
                : '#ffffff'
          }
        })}
        rowCount = {Number.MAX_VALUE}
        enablePagination
        manualPagination
        muiTablePaginationProps = {{
          showFirstButton: false,
          showLastButton: false
        }}
        state = {{
          density: 'compact',
          pagination: { pageIndex: store.cuboidsPage, pageSize: store.cuboidsPageSize }
        }}
        onPaginationChange={(updater: any) => {
          const model = updater({pageIndex: store.cuboidsPage, pageSize: store.cuboidsPageSize});
          runInAction(() => {
            store.cuboidsPage = model.pageIndex;
            store.cuboidsPageSize = model.pageSize;
          });
          grpc.unary(SudokubeService.getPreparedCuboids, {
            host: apiBaseUrl,
            request: buildMessage(new GetPreparedCuboidsArgs(), {
              requestedPageId: model.pageIndex,
              numRowsInPage: model.pageSize
            }),
            onEnd: response => {
              if (response.status !== 0) {
                runInAction(() => {
                  errorStore.errorMessage = response.statusMessage;
                  errorStore.isErrorPopupOpen = true;
                });
                return;
              }
              runInAction(() => {
                store.preparedCuboids = (response.message as GetPreparedCuboidsResponse).getCuboidsList()
              })
            }
          });
        }}
        muiBottomToolbarProps = {{
          sx: {
            '.MuiTablePagination-displayedRows': { display: 'none' },
            '.MuiTablePagination-selectLabel': { display: 'none' },
            '.MuiTablePagination-select': { display: 'none' },
            '.MuiTablePagination-selectIcon': { display: 'none' }
          } 
        }}
        renderTopToolbar = {false}
      />
    </div>
    <Button
      disabled = {store.isQueryComplete}
      onClick = {() => {
        runInAction(() => store.isUpdatedResultLoading = true);
        grpc.unary(SudokubeService.continueQuery, {
          host: apiBaseUrl,
          request: new Empty(),
          onEnd: res => {
            runInAction(() => store.isUpdatedResultLoading = false);
            if (res.status !== 0) {
              runInAction(() => {
                errorStore.errorMessage = res.statusMessage;
                errorStore.isErrorPopupOpen = true;
              });
              return;
            }
            const message = res.message as QueryResponse;
            runInAction(() => {
              store.cuboidsPage = store.currentCuboidPage = message.getCuboidsPageId();
              store.preparedCuboids = message.getCuboidsList();
              store.currentCuboidIdWithinPage = message.getCurrentCuboidIdWithinPage();
              store.isQueryComplete = message.getIsComplete();
              store.result = { data: message.getSeriesList().map(seriesData => ({
                id: seriesData.getSeriesName(),
                data: seriesData.getDataList().map(point => point.toObject())
              })) };
              store.metrics = message.getStatsList().map(stat => stat.toObject());
              store.showResults = true;
            })
          }
        })
      }}
    >Continue</Button>
  </div> );
})

const Chart = observer(({isShown, hasBounds}: {isShown: boolean, hasBounds: boolean}) => {
  if (!isShown) {
    return null;
  }
  const { queryStore: store } = useRootStore();
  
  const colorsRgbHex = [
    0xe41a1c, 0x377eb8, 0x4daf4a, 0x984ea3, 0xff7f00, 0xffff33, 0xa65628, 0xf781bf, 0x999999
  ];
  const colorsRgbJoined = colorsRgbHex.map(hex => 
    [(hex >> 16), (hex >> 8) & 0xff, hex & 0xff].join(',')
  );
  const defaultColors = colorsRgbJoined.map(rgb => 'rgba(' + rgb + ',1)');
  const seriesWithBoundsColors = colorsRgbJoined.flatMap(rgb => [
    'rgba(' + rgb + ',1)',
    'rgba(' + rgb + ',0.2)',
    'rgba(' + rgb + ',0.2)'
  ]);

  const yValueFormatter = (v: ScaleValue) => v as number < 1e+6 ? v.toString() : format('>-.2g')(v as number);
  const rotateXAxisValues = store.result.data[0]?.data.length > 8;

  return ( <div>
    <h3 style = {{ alignItems: 'center' }}>
      <span>Current result</span>
      <span hidden = {!store.isUpdatedResultLoading}>
        <CircularProgress size = '1rem' style = {{ marginLeft: 10, verticalAlign: 'middle' }} />
      </span>
    </h3>
    <div style={{ width: '100%', height: 400, margin: 0 }}>
      <ResponsiveLine
        data = { store.result.data }
        colors = { hasBounds ? seriesWithBoundsColors : defaultColors }
        margin={{ top: 5, right: 75, bottom: rotateXAxisValues ? 100 : 30, left: 100 }}
        yScale={{
          type: 'linear',
          min: 'auto',
          max: 'auto',
          stacked: false,
          reverse: false
        }}
        yFormat = {yValueFormatter}
        axisLeft = {{ format: yValueFormatter }}
        axisBottom = {{ tickRotation: rotateXAxisValues ? -30 : 0 }}
        axisTop={null}
        axisRight={null}
        pointLabelYOffset={-12}
        useMesh={true}
        tooltip = {({point}) => (
          <div style = {{
            padding: 5,
            background: 'white',
            fontSize: 12,
            maxWidth: 400,
            boxShadow: '0 0 4px #888888',
            borderRadius: 3
          }}>
            <div>
              <svg style = {{ width: 9, height: 8, padding: 0, margin: 0, marginRight: 5 }}>
                <circle
                  r={4} cx={4} cy={4}
                  fill={point.color} opacity={1}
                  stroke-width={0} stroke='rgba(0, 0, 0, .5)'
                  style = {{ pointerEvents: 'none' }}
                />
              </svg>
              <b>{point.serieId}</b>
            </div>
            <div>x: <b>{point.data.x}</b></div>
            <div>y: <b>{point.data.y}</b></div>
          </div>
        )}
      />
    </div>
    <div style = {{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
      { store.result.data.flatMap((seriesData, index) =>
        hasBounds && index % 3 != 0
          ? []
          : [(<span style = {{ margin: '0px 10px', display: 'inline' }}>
            <svg style = {{ width: 11, height: 10, padding: 0, margin: 0, marginRight: 5 }}>
              <circle
                r={5} cx={5} cy={5}
                fill={defaultColors[(hasBounds ? (index / 3) : index) % colorsRgbHex.length]}
                opacity={1}
                stroke-width={0} stroke='rgba(0, 0, 0, .5)'
                style = {{ pointerEvents: 'none' }}
              />
            </svg>
            <span style = {{ fontSize: 13 }}>{seriesData.id}</span>
          </span>)]
      )}
    </div>
  </div> );
})

const Metrics = observer(({isShown}: {isShown: boolean}) => {
  if (!isShown) {
    return null;
  }
  const { queryStore: store } = useRootStore();
  return ( <div>
    <h3>Metrics</h3>
    <TableContainer>
      <Table sx = {{ width: 'auto' }} aria-label = "simple table" size = 'small'>
        <TableHead>
          <TableRow>
            { store.metrics.map(metric => <TableCell>{metric.name}</TableCell>) }
          </TableRow>
        </TableHead>
        <TableBody>
          { store.metrics.map(metric => <TableCell>{metric.value}</TableCell>) }
        </TableBody>
      </Table>
    </TableContainer>
  </div> );
});

const dimensionToColumn = ((dimension: CuboidDimension): MRT_ColumnDef<any> => ({
  accessorKey: dimension.getName(),
  header: dimension.getName() + ' (' + dimension.getNumBits() + ' bits)'
}));
