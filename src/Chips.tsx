import React, { ReactNode } from 'react'
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, InputLabel, MenuItem, Select } from '@mui/material'
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useRootStore } from './RootStore';

export function InChipButton({ icon }: { icon: ReactNode }) {
  return (
    <Button style={{
      padding: '0px', border: '0px', margin: '0px', 
      height: '23px', minWidth: '16px', maxWidth: '16px', 
      display: 'inline'
    }}>
      {icon}
    </Button>
  )
}
  
export const chipStyle = {
  height: '22px',
  marginLeft: '0px', marginRight: '5px', marginTop: '0px', marginBottom: '5px'
}

export function DimensionChip({ type, text, onDelete }: {
  type: 'Horizontal' | 'Series', 
  text: ReactNode, 
  onDelete: ((event: any) => void) | undefined
}) {
  return (<Chip
    style={chipStyle}
    variant='outlined'
    icon = { 
      type == 'Horizontal' 
        ? <ArrowForwardIcon style = {{ height: '15px' }} /> 
        : <SsidChartIcon style = {{ height: '15px' }} />
    }
    label = { <span>
      {text} 
      <InChipButton icon = { <AddIcon style = {{ width: '16px', height: '16px', marginTop: '3px' }} /> } />
      <InChipButton icon = { <RemoveIcon style = {{ width: '16px', height: '16px', marginTop: '3px' }} /> } />
    </span> }
    onDelete = {onDelete}
  />)
}

export function AddDimensionChip({ type }: { type: 'Horizontal' | 'Series'}) {
  const { queryStore } = useRootStore();
  const dimensionsHierarchy = queryStore.metadata.dimensionHierarchy;
  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const [dimensionIndex, setDimensionIndex] = React.useState(0);
  const [dimensionLevelIndex, setDimensionLevelIndex] = React.useState(0);

  return (<span>
    <Chip
      style={chipStyle}
      variant='outlined'
      icon = { 
        type == 'Horizontal' 
          ? <ArrowForwardIcon style = {{ height: '15px' }} /> 
          : <SsidChartIcon style = {{ height: '15px' }} />
      }
      label = 'Add ...'
      color = 'primary'
      onClick = {() => { setDialogOpen(true) }}
    />

    <Dialog open = {isDialogOpen}>
      <DialogTitle>Add Dimension</DialogTitle>
      <DialogContent>
        <FormControl sx={{ m: 1, minWidth: 120 }}>
          <InputLabel htmlFor="add-dimension-select-dimension">Dimension</InputLabel>
          <Select
            value = {dimensionIndex}
            onChange = { e => setDimensionIndex(e.target.value as number) }
            id="add-dimension-select-dimension" label="Dimension">
            { dimensionsHierarchy.dimensions.map((dimension, index) => (
              <MenuItem key = { 'add-dimension-select-dimension-' + index } value = {index}> {dimension.name} </MenuItem>
            )) }
          </Select>
        </FormControl>
        <FormControl sx={{ m: 1, minWidth: 120 }}>
          <InputLabel htmlFor="add-dimension-select-dimension-level">Dimension Level</InputLabel>
          <Select
            value = {dimensionLevelIndex}
            onChange = { e => setDimensionLevelIndex(e.target.value as number) }
            id="add-dimension-select-dimension-level" label="Dimension Level">
            { dimensionsHierarchy.dimensions[dimensionIndex].dimensionLevels.map((level, index) => (
              <MenuItem key = { 'add-dimension-select-dimension-level-' + index } value = {index}>{level.name}</MenuItem>
            )) }
          </Select>
        </FormControl>
        <DialogActions>
          <Button onClick = { () => setDialogOpen(false) }>Cancel</Button>
          <Button onClick = { () => { 
            switch (type) {
              case 'Horizontal': queryStore.inputs.addHorizontal(dimensionIndex, dimensionLevelIndex); break;
              case 'Series': queryStore.inputs.addSeries(dimensionIndex, dimensionLevelIndex); break;
            }
            setDialogOpen(false);
          } }>Add</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  </span>)
}

export function FilterChip({ text, onDelete }: {
  text: ReactNode, onDelete: ((event: any) => void) | undefined 
}) {
  return (<Chip
    style = {chipStyle}
    variant = 'outlined'
    icon = { <FilterAltIcon style = {{ height: '18px' }} /> }
    label = {text} 
    onDelete = {onDelete}
  />)
}

export function SelectionChip({ keyText, valueText }: {
  keyText: ReactNode, valueText: ReactNode 
}) {
  return (<Chip 
    style = {chipStyle}
    variant='outlined'
    label={<span><b>{keyText} </b>{valueText}</span>}
    onClick={()=>{}} 
  />)
}