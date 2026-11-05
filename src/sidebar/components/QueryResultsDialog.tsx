import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';

export interface QueryResults {
  resultLabel: string;
  entityName: string;
  headers: string[];
  rows: string[][];
  totalCount: number;
  isTruncated: boolean;
}

interface QueryResultsDialogProps {
  results: QueryResults | null;
  onClose: () => void;
}

const QueryResultsDialog: React.FC<QueryResultsDialogProps> = ({ results, onClose }) => (
  <Dialog open={results !== null} onClose={onClose} maxWidth='lg' fullWidth>
    <DialogTitle>
      {results ? `${results.resultLabel} Results (${results.totalCount})` : ''}
    </DialogTitle>
    <DialogContent dividers>
      {results?.isTruncated && (
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          Showing the first 100 returned records.
        </Typography>
      )}
      <TableContainer component={Paper} variant='outlined'>
        <Table
          size='small'
          stickyHeader
          aria-label={results ? `${results.entityName} query results` : undefined}
        >
          <TableHead>
            <TableRow>
              {results?.headers.map(header => (
                <TableCell key={header}>{header}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {results?.rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((value, columnIndex) => (
                  <TableCell key={columnIndex}>{value}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>{'Close'}</Button>
    </DialogActions>
  </Dialog>
);

export default QueryResultsDialog;
