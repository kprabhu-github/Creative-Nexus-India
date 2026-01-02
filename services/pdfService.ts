import { jsPDF } from "jspdf";
import { AgreementState, ClientDetails, ProjectScope } from "../types";
import { CONTRACT_TEXT, NDA_TEXT } from "../constants";

const AGENCY_DETAILS = {
  name: "Creative Nexus India",
  address: "101 Innovation Tower, Cyber City\nGurugram, Haryana, 122002",
  contact: "hello@creativenexus.in",
  phone: "+91 98765 43210"
};

export const generateSignedPDF = async (
  client: ClientDetails,
  scope: ProjectScope,
  agreement: AgreementState
): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = 20;

  const checkPageBreak = (heightNeeded: number) => {
      if (yPos + heightNeeded > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
          return true;
      }
      return false;
  };

  const addSectionTitle = (title: string, fontSize = 12) => {
      checkPageBreak(fontSize + 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontSize);
      doc.setTextColor(30, 41, 59); 
      doc.text(title.toUpperCase(), margin, yPos);
      yPos += 8;
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos - 2, margin + 50, yPos - 2);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
  };

  const addBlockText = (text: string, fontSize = 10) => {
      doc.setFontSize(fontSize);
      const splitText = doc.splitTextToSize(text, contentWidth);
      const lineHeight = fontSize * 0.5; 
      splitText.forEach((line: string) => {
          checkPageBreak(lineHeight);
          doc.text(line, margin, yPos);
          yPos += lineHeight;
      });
      yPos += 5; 
  };

  const drawTableRow = (
      label: string, 
      value: string, 
      startX: number, 
      col1W: number, 
      col2W: number
  ): number => {
      const padding = 4;
      const fontSize = 10;
      doc.setFontSize(fontSize);
      const labelLines = doc.splitTextToSize(label, col1W - (padding * 2));
      const valueLines = doc.splitTextToSize(value || "-", col2W - (padding * 2));
      const lineCount = Math.max(labelLines.length, valueLines.length);
      const rowHeight = (lineCount * 5) + (padding * 2);
      checkPageBreak(rowHeight);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.rect(startX, yPos, col1W, rowHeight);
      doc.rect(startX + col1W, yPos, col2W, rowHeight);
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "bold");
      doc.text(labelLines, startX + padding, yPos + padding + 4);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.text(valueLines, startX + col1W + padding, yPos + padding + 4);
      return rowHeight;
  };

  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Ref: ${agreement.ticketNumber || 'N/A'}`, pageWidth - margin - 40, 20);
  doc.text(`Date: ${agreement.signedDate || new Date().toLocaleDateString()}`, pageWidth - margin - 40, 25);

  yPos = 35;
  doc.setFontSize(18);
  doc.setTextColor(217, 11, 45);
  doc.setFont("helvetica", "bold");
  doc.text("MASTER SERVICE AGREEMENT", margin, yPos);
  doc.setDrawColor(217, 11, 45);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
  yPos += 15;

  addSectionTitle("1. Client Details");
  const tableWidth = contentWidth;
  const col1W = tableWidth * 0.3;
  const col2W = tableWidth * 0.7;

  const clientData = [
      { label: "Company Name", value: client.companyName },
      { label: "Contact Name", value: client.contactName },
      { label: "Designation", value: client.designation },
      { label: "Email", value: client.contactEmail },
      { label: "Phone", value: `${client.phoneCountryCode} ${client.contactPhone}` },
      { label: "Address", value: client.billingAddress },
      { label: "GST Number", value: client.gstNumber }
  ];

  clientData.forEach(item => {
      yPos += drawTableRow(item.label, item.value, margin, col1W, col2W);
  });

  yPos += 15;
  addSectionTitle("2. Agency Details");
  const agencyData = [
      { label: "Agency Name", value: AGENCY_DETAILS.name },
      { label: "Address", value: AGENCY_DETAILS.address },
      { label: "Contact Email", value: AGENCY_DETAILS.contact },
      { label: "Phone", value: AGENCY_DETAILS.phone }
  ];
  agencyData.forEach(item => {
      yPos += drawTableRow(item.label, item.value, margin, col1W, col2W);
  });

  doc.addPage();
  yPos = margin;
  addSectionTitle("Exhibit A: Scope of Work");
  addSectionTitle("1. Services Included", 11);
  scope.services.forEach(service => {
    doc.setFontSize(10);
    doc.text(`• ${service.replace(/_/g, ' ').toUpperCase()}`, margin + 5, yPos);
    yPos += 6;
  });
  yPos += 5;
  addSectionTitle("2. Deliverables", 11);
  addBlockText(scope.deliverables || "As per attached SOW.");
  
  doc.addPage();
  yPos = margin;
  addSectionTitle("Master Service Agreement (MSA)");
  addBlockText(CONTRACT_TEXT);

  doc.addPage();
  yPos = margin;
  addSectionTitle("Non-Disclosure Agreement (NDA)");
  addBlockText(`This NDA is entered into between ${AGENCY_DETAILS.name} ("Disclosing Party") and ${client.companyName} ("Receiving Party").`);
  yPos += 5;
  addBlockText(NDA_TEXT);

  doc.addPage();
  yPos = margin;
  doc.setFontSize(16);
  doc.setTextColor(217, 11, 45); 
  doc.setFont("helvetica", "bold");
  doc.text("EXECUTION OF AGREEMENT", margin, yPos);
  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(0,0,0);
  doc.setFont("helvetica", "normal");
  addBlockText("By signing below, the Client agrees to be bound by the Master Service Agreement, Scope of Work, and Non-Disclosure Agreement.");
  yPos += 10;

  const boxH = 90;
  const boxW = contentWidth;
  checkPageBreak(boxH);
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(252, 252, 252);
  doc.rect(margin, yPos, boxW, boxH, 'FD');
  let boxY = yPos;
  doc.setFillColor(217, 11, 45);
  doc.rect(margin, boxY, boxW, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("AUTHORIZED SIGNATORY", margin + 5, boxY + 7);

  const contentY = boxY + 25;
  if (agreement.signatureData) {
      try { doc.addImage(agreement.signatureData, 'PNG', margin + 5, contentY, 50, 25); } catch(e){}
  }
  if (agreement.sealData) {
      try { doc.addImage(agreement.sealData, 'PNG', margin + 60, contentY, 25, 25); } catch(e){}
  }

  const textX = margin + 100;
  const lineGap = 15;
  const drawSigLine = (label: string, val: string, y: number) => {
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(label.toUpperCase(), textX, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(val, textX, y + 5);
      doc.setDrawColor(200, 200, 200);
      doc.line(textX, y + 7, textX + 70, y + 7);
  };

  drawSigLine("Name", agreement.signerName, contentY);
  drawSigLine("Title", agreement.signerTitle, contentY + lineGap);
  drawSigLine("Company", client.companyName, contentY + (lineGap * 2));
  drawSigLine("Date", agreement.signedDate, contentY + (lineGap * 3));

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Digitally executed via Creative Nexus Platform", margin + 5, boxY + boxH - 5);

  return doc.output('blob');
};

export const sendAgreementEmail = async (email: string, pdfBlob: Blob): Promise<boolean> => {
    console.log(`Sending email to ${email}, size: ${pdfBlob.size}`);
    return new Promise(r => setTimeout(() => r(true), 1500));
};