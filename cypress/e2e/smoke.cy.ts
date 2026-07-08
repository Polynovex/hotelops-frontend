describe('HotelOpX dashboard smoke', () => {
  it('loads login page', () => {
    cy.visit('/login');
    cy.contains('HotelOpX');
  });
});
