EmptyChessBoard.prototype.handleSquareClick = function(row, col) {
  // ... your function code ...
  if (this.gameOver) return;
  const pieceCode = this.boardState[row][col];

  // Case 1: No piece is currently selected
  if (this.selectedSquare === null) {
    // Only allow selecting pieces matching your active turn AND assigned multiplayer color
    const isMyPiece = pieceCode && pieceCode[0] === this.turn;
    const isMyMultiplayerColor = this.isRemoteMove || (this.playerColor === null || pieceCode[0] === this.playerColor);

    if (isMyPiece && isMyMultiplayerColor) {
      this.selectedSquare = { row, col };
      this.squares[row][col].classList.add('selected');
      this.showPossibleMoves({ row, col });
    }
  }
  // Case 2: A piece is already selected
  else {
    const from = this.selectedSquare;
    const movingPiece = this.boardState[from.row][from.col];
    this.clearPossibleMoves();

    // 1. If clicking a piece of the SAME color, switch selection to that piece instead
    if (pieceCode && pieceCode[0] === movingPiece[0]) {
      this.squares[from.row][from.col].classList.remove('selected');
      this.selectedSquare = { row, col };
      this.squares[row][col].classList.add('selected');
      this.showPossibleMoves({ row, col });
      return;
    }

    // 2. If clicking the same square, cancel selection
    if (from.row === row && from.col === col) {
      this.squares[from.row][from.col].classList.remove('selected');
      this.selectedSquare = null;
      return;
    }

    // 3. Enforce movement validation rules
    const pieceType = movingPiece[1];
    if (pieceType === 'r') {
      if (!this.isValidRookMove(from, { row, col })) return;
    }
    if (pieceType === 'b') {
      if (!this.isValidBishopMove(from, { row, col })) return;
    }
    if (pieceType === 'q') {
      if (!this.isValidQueenMove(from, { row, col })) return;
    }
    if (pieceType === 'n') {
      if (!this.isValidKnightMove(from, { row, col })) return;
    }
    if (pieceType === 'p') {
      const color = movingPiece[0];
      if (!this.isValidPawnMove(from, { row, col }, color)) return;
    }
    if (pieceType === 'k') {
      const color = movingPiece[0];
      if (!this.isValidKingMove(from, { row, col }, color)) return;
    }

    // Clear active selection states (only after the move is validated)
    this.squares[from.row][from.col].classList.remove('selected');
    this.selectedSquare = null;

    // Check and process scores for captured pieces, detecting if a King is captured
    const targetPiece = this.boardState[row][col];
    if (targetPiece) {
      const pieceTypeTarget = targetPiece[1];
      const value = this.pieceValues[pieceTypeTarget] || 0;
      
      if (this.turn === 'w') {
        this.whiteScore += value;
        this.whiteScoreEl.textContent = this.whiteScore;
      } else {
        this.blackScore += value;
        this.blackScoreEl.textContent = this.blackScore;
      }

      // End the game if a King ('k') is captured (storing the announcement text)
      if (pieceTypeTarget === 'k') {
        this.gameOver = true;
        const winner = this.turn === 'w' ? 'White' : 'Black';
        this.winnerAnnouncement = `<strong>Game Over! ${winner} Won!</strong>`;
      }
    }

    // Automatically move the Rook if castling is executed
    if (pieceType === 'k' && Math.abs(from.col - col) === 2) {
      const rowNum = movingPiece[0] === 'w' ? 7 : 0;
      if (col === 6) { // Kingside
        this.boardState[rowNum][5] = this.boardState[rowNum][7];
        this.boardState[rowNum][7] = null;
      } else if (col === 2) { // Queenside
        this.boardState[rowNum][3] = this.boardState[rowNum][0];
        this.boardState[rowNum][0] = null;
      }
    }

    // 4. Simulate the move to verify if the active King is still under attack after the turn
    const originalTarget = this.boardState[row][col];
    
    // Temporarily apply the move on the board state
    this.boardState[row][col] = movingPiece;
    this.boardState[from.row][from.col] = null;
    // Append the move to the visual history panel
    this.addMoveToHistory(from, { row, col }, movingPiece);
    
    const kingUnderAttack = this.isKingInCheck(this.turn);
    
    // Revert the temporary move back to original state
    this.boardState[from.row][from.col] = movingPiece;
    this.boardState[row][col] = originalTarget;
    
    // If the active King remains under attack, trigger a pop-up and block the turn
    if (kingUnderAttack) {
      const proceed = confirm("Your King is still under attack!");
      if (!proceed) {
        return; // Abort turn and preserve active piece selection
      }
    }

    // Get the DOM piece before changing states (FLIP: "First" state)
    const pieceEl = this.squares[from.row][from.col].querySelector('.piece');

    if (pieceEl) {
      const firstRect = pieceEl.getBoundingClientRect();

      // Check if this move is an En Passant capture
      const isEnPassantCapture = pieceType === 'p' && 
                                this.enPassantSquare && 
                                row === this.enPassantSquare.row && 
                                col === this.enPassantSquare.col;

      if (isEnPassantCapture) {
        // Determine where the captured pawn is sitting (behind the target square)
        const capturedPawnRow = this.turn === 'w' ? row + 1 : row - 1;
        
        // Award score
        if (this.turn === 'w') {
          this.whiteScore += 1;
          this.whiteScoreEl.textContent = this.whiteScore;
        } else {
          this.blackScore += 1;
          this.blackScoreEl.textContent = this.blackScore;
        }

        // Erase the physical pawn from state
        this.boardState[capturedPawnRow][col] = null;
      }

      // Track if a two-square pawn push occurred to set the next turn's En Passant target
      let nextEnPassantSquare = null;
      if (pieceType === 'p' && Math.abs(from.row - row) === 2) {
        const middleRow = (from.row + row) / 2;
        nextEnPassantSquare = { row: middleRow, col: from.col };
      }
      // Update data state
      this.boardState[row][col] = movingPiece;
      this.boardState[from.row][from.col] = null;
      // Send your local move coordinates to the server so the opponent can replicate them
      if (!this.isRemoteMove && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ from, to: { row, col } }));
      }
      // Record if King or Rook has moved for future castling checks
      if (pieceType === 'k') {
        this.hasMoved[movingPiece[0] + '_k'] = true;
      }
      if (pieceType === 'r') {
        const color = movingPiece[0];
        if (from.row === (color === 'w' ? 7 : 0)) {
          if (from.col === 0) this.hasMoved[color + '_r_left'] = true;
          if (from.col === 7) this.hasMoved[color + '_r_right'] = true;
        }
      }
      
      // Switch active turn, update En Passant targets, and evaluate check status
      if (this.gameOver) {
        document.querySelector('.turn-indicator').innerHTML = this.winnerAnnouncement;
      } else {
        this.turn = this.turn === 'w' ? 'b' : 'w';
        this.enPassantSquare = nextEnPassantSquare;
        
        const whiteCheck = this.isKingInCheck('w');
        const blackCheck = this.isKingInCheck('b');
        let label = this.turn === 'w' ? 'White' : 'Black';
        if (whiteCheck) label += ' | White in Check';
        if (blackCheck) label += ' | Black in Check';
        this.turnTextEl.textContent = label;
      }

      // Update DOM to target position (FLIP: "Last" state)
      this.renderPieces();

      // Find the piece at its new target square
      const newPieceEl = this.squares[row][col].querySelector('.piece');
      if (newPieceEl) {
        const lastRect = newPieceEl.getBoundingClientRect();

        // Calculate translation delta (FLIP: "Invert" state)
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;

        // Position the piece back to its starting spot instantly
        newPieceEl.style.transition = 'none';
        newPieceEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

        // Force browser layout calculation (reflow)
        newPieceEl.offsetWidth;

        // Play translation to (0,0) smoothly (FLIP: "Play" state)
        newPieceEl.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
        newPieceEl.style.transform = 'translate(0, 0)';

        // Clean up temporary styles after animation finishes
        newPieceEl.addEventListener('transitionend', () => {
          newPieceEl.style.transition = '';
          newPieceEl.style.transform = '';
        }, { once: true });
      }
    } else {
      
      // Fallback update without animation if element is missing
      this.boardState[row][col] = movingPiece;
      this.boardState[from.row][from.col] = null;
      // Send your local move coordinates to the server so the opponent can replicate them
      if (!this.isRemoteMove && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ from, to: { row, col } }));
      }
      // Append the move to the visual history panel
      this.addMoveToHistory(from, { row, col }, movingPiece);
      
      if (this.gameOver) {
        document.querySelector('.turn-indicator').innerHTML = this.winnerAnnouncement;
      } else {
        this.turn = this.turn === 'w' ? 'b' : 'w';
        this.enPassantSquare = nextEnPassantSquare;
        
        const whiteCheck = this.isKingInCheck('w');
        const blackCheck = this.isKingInCheck('b');
        let label = this.turn === 'w' ? 'White' : 'Black';
        if (whiteCheck) label += ' | White in Check';
        if (blackCheck) label += ' | Black in Check';
        this.turnTextEl.textContent = label;
      }

      this.renderPieces();
    }
  }
};
