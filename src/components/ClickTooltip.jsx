import React, { useState } from 'react';
import { Tooltip, Box, ClickAwayListener } from '@mui/material';

const ClickTooltip = ({ children, title, arrow = true, placement = 'top' }) => {
  const [open, setOpen] = useState(false);

  const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = () => {
    setOpen(true);
  };

  return (
    <ClickAwayListener onClickAway={handleTooltipClose}>
      <Tooltip
        PopperProps={{
          disablePortal: true,
        }}
        onClose={handleTooltipClose}
        open={open}
        disableFocusListener
        disableHoverListener
        disableTouchListener
        title={title}
        arrow={arrow}
        placement={placement}
      >
        <Box onClick={handleTooltipOpen} sx={{ cursor: 'pointer' }}>
          {children}
        </Box>
      </Tooltip>
    </ClickAwayListener>
  );
};

export default ClickTooltip;
